from pathlib import Path
import json

from playwright.sync_api import sync_playwright

import config
from sites import SITES


detector_script = Path(
    config.DETECTOR_FILE
).read_text(encoding="utf-8")

def save_json(site, result):

    name = (
        site
        .replace("https://", "")
        .replace("http://", "")
        .replace("/", "_")
    )

    out = (
        Path(config.RESULT_FOLDER)
        / "json"
        / f"{name}.json"
    )

    out.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    out.write_text(
        json.dumps(
            result,
            indent=4
        ),
        encoding="utf-8"
    )


def main():
    with sync_playwright() as p:
        device = p.devices[config.DEVICE_NAME]

        browser = p.chromium.launch(
            headless=config.HEADLESS
        )

        for site in SITES:
            context = None
            try:

                print("=" * 80)
                print(site)

                context = browser.new_context(
                    **device
                )

                page = context.new_page()
                try:
                    page.goto(
                        site,
                        wait_until="networkidle",
                        timeout=60000
                    )
                except:
                    page.goto(
                        site,
                        wait_until="load"
                    )

                page.wait_for_timeout(
                    config.WAIT_AFTER_NETWORK_IDLE_MS
                )

                name = (
                    site
                    .replace("https://", "")
                    .replace("/", "_")
                )

                before = (
                    Path(config.RESULT_FOLDER)
                    / "before"
                    / f"{name}.png"
                )

                before.parent.mkdir(
                    parents=True,
                    exist_ok=True
                )

                page.screenshot(
                    path=str(before),
                    full_page=False
                )
                page.evaluate(detector_script)
                result = page.evaluate("""

        () => {

            return PopupDetector.run({

                hideStrategy: "display",

                debug: false,

                verbose: false

            });

        }

        """)
                save_json(
                    site,
                    result
                )
                after = (
                    Path(config.RESULT_FOLDER)
                    / "after"
                    / f"{name}.png"
                )

                after.parent.mkdir(
                    parents=True,
                    exist_ok=True
                )

                page.screenshot(
                    path=str(after),
                    full_page=False
                )
            except Exception as e:
                print(site)
                print(e)
            finally:
                if context:
                    context.close()
        browser.close()

if __name__ == "__main__":
    main()
