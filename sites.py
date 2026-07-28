from pathlib import Path
from playwright.sync_api import sync_playwright

# with sync_playwright() as p:
#     for d in sorted(p.devices.keys()):
#         print(d)

def load_sites(limit=20):

    sites = []

    with open("domains.txt", encoding="utf-8") as f:

        for line in f:

            line = line.strip()

            if not line:
                continue

            _, domain = line.split(maxsplit=1)

            sites.append(f"https://{domain}")

            if len(sites) >= limit:
                break

    return sites

SITES = load_sites(5)

for site in load_sites(50):
    print(site)