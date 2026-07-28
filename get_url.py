from collections import Counter
from pathlib import Path

INPUT = "easylistRaw.txt"
OUTPUT = "domains.txt"

counter = Counter()

with open(INPUT, encoding="utf-8", errors="ignore") as f:

    for line in f:

        line = line.strip()

        if not line:
            continue

        #
        # Ignore comments
        #

        if line.startswith("!"):
            continue

        #
        # Cosmetic filters only
        #

        separator = None

        for s in ("##", "#@#", "#?#"):

            if s in line:
                separator = s
                break

        if separator is None:
            continue

        domains = line.split(separator)[0]

        if not domains:
            continue

        for domain in domains.split(","):

            domain = domain.strip()

            #
            # Ignore exclusions
            #

            if domain.startswith("~"):
                continue

            #
            # Ignore regex-like entries
            #

            if any(
                c in domain
                for c in (
                    "*",
                    "^",
                    "/",
                    "(",
                    ")",
                    "|"
                )
            ):
                continue

            if "." not in domain:
                continue

            counter[domain] += 1

with open(OUTPUT, "w") as out:

    for domain, count in counter.most_common():

        out.write(
            f"{count:5d} {domain}\n"
        )