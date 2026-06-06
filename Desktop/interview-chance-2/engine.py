"""
Canadian medical school interview eligibility rule engine.

Plain Python — no classes, frameworks, or external dependencies.
"""

MCAT_KEYS = ("cp", "cars", "bb", "ps")
MCAT_LABELS = {"cp": "CP", "cars": "CARS", "bb": "BB", "ps": "PS"}


def process_gpa(applicant):
    """
    Return (gpa_for_general, best2_gpa, last3_gpa).

    When gpa_by_year is provided, best2 and last3 are computed from it;
    general GPA remains cgpa. When omitted, cgpa is used for all three.
    """
    cgpa = applicant["cgpa"]
    years = applicant.get("gpa_by_year")

    if years:
        sorted_years = sorted(years, reverse=True)
        best2_gpa = sum(sorted_years[:2]) / min(2, len(sorted_years))
        recent = years[-3:]
        last3_gpa = sum(recent) / len(recent)
        return cgpa, best2_gpa, last3_gpa

    return cgpa, cgpa, cgpa


def western_best_two_years(applicant):
    """Top two individual year GPAs used for Western screening."""
    years = applicant.get("gpa_by_year")
    if years:
        return sorted(years, reverse=True)[:2]
    return [applicant["cgpa"]]


def western_gpa_eligible(applicant):
    """Both of the applicant's best two years must be >= 3.70."""
    return all(year_gpa >= 3.70 for year_gpa in western_best_two_years(applicant))


def mcat_values(applicant):
    sections = applicant["mcat_sections"]
    return [sections[key] for key in MCAT_KEYS]


def uoft_mcat_eligible(applicant):
    """All sections >= 125, with at most one section allowed at 124."""
    values = mcat_values(applicant)
    if all(score >= 125 for score in values):
        return True
    below_125 = [score for score in values if score < 125]
    return len(below_125) == 1 and below_125[0] >= 124


def uoft_mcat_failures(applicant):
    """Return MCAT section labels that fail UofT rules."""
    sections = applicant["mcat_sections"]
    failures = []
    for key in MCAT_KEYS:
        score = sections[key]
        if score < 124:
            failures.append(f"{MCAT_LABELS[key]} ({score})")
        elif score == 124:
            below_125 = [k for k in MCAT_KEYS if sections[k] < 125]
            if len(below_125) > 1:
                failures.append(f"{MCAT_LABELS[key]} ({score})")
        elif score < 125:
            failures.append(f"{MCAT_LABELS[key]} ({score})")
    return failures


def check_interview_invite(gpa, cars, casper_percentile):
    cars_baseline = {
        132: 40,
        131: 51,
        130: 62,
        129: 77,
        128: 85,
        127: 91,
        126: 96,
        125: 100,
    }

    gpa = max(0, min(4.0, gpa))
    casper_percentile = max(0, min(100, casper_percentile))

    base = cars_baseline.get(cars, 100)

    required_casper = min(100, base + 50 * (4.0 - gpa))

    return "Yes" if casper_percentile >= required_casper else "No"


def mcmaster_required_casper(gpa, cars):
    """Mirror McMaster formula for explanatory text only."""
    cars_baseline = {
        132: 40,
        131: 51,
        130: 62,
        129: 77,
        128: 85,
        127: 91,
        126: 96,
        125: 100,
    }
    gpa = max(0, min(4.0, gpa))
    base = cars_baseline.get(cars, 100)
    return round(min(100, base + 50 * (4.0 - gpa)))


def uoft(applicant):
    gpa, _, _ = process_gpa(applicant)
    gpa_ok = gpa >= 3.85
    mcat_ok = uoft_mcat_eligible(applicant)

    if gpa_ok and mcat_ok:
        return {
            "status": "Likely eligible",
            "explanation": (
                f"Your cGPA of {gpa:.2f} and MCAT profile meet UofT's published academic "
                "screening thresholds, so you are academically competitive at this stage. "
                "This means you have your foot in the door for further review, not a guaranteed interview. "
                "UofT's final decisions depend heavily on your autobiographical sketch (ABS) and essays, "
                "where non-academic strengths and fit are weighed after the initial screen."
            ),
        }

    reasons = []
    if not gpa_ok:
        reasons.append(f"cGPA {gpa:.2f} is below 3.85, which is sometimes quoted as the minimum GPA possible for an interview (3.89 is another number sometimes quoted)")
    if not mcat_ok:
        failed = uoft_mcat_failures(applicant)
        if failed:
            reasons.append("MCAT section(s) below threshold: " + ", ".join(failed))
        else:
            reasons.append("MCAT does not meet the rule (all sections ≥ 125, with at most one at 124)")

    return {
        "status": "Likely not eligible",
        "explanation": (
            "You do not meet UofT's academic screen based on the following: "
            + "; ".join(reasons)
            + ". "
            "Without being in the competitive GPA range or meeting the MCAT cutoffs, your file is unlikely to advance regardless of ABS or essays. "
            "Strengthen the listed area(s) before reapplying or targeting UofT."
        ),
    }


def western(applicant):
    gpa_ok = western_gpa_eligible(applicant)
    best_two = western_best_two_years(applicant)
    mcat_sections = applicant["mcat_sections"]
    failed_mcat = [
        f"{MCAT_LABELS[key]} ({mcat_sections[key]})"
        for key in MCAT_KEYS
        if mcat_sections[key] < 126
    ]
    mcat_ok = not failed_mcat

    if gpa_ok and mcat_ok:
        years_text = " and ".join(f"{y:.2f}" for y in best_two)
        return {
            "status": "Likely eligible",
            "explanation": (
                f"Both of your best two years ({years_text}) are at or above 3.70, and all MCAT "
                "sections are ≥ 126, so you pass Western's first academic filter. "
                "Western uses a multi-stage system: eligible applicants next complete the Kira Talent "
                "online video interview. Kira performance strongly influences who is invited to a "
                "traditional panel interview, so meeting cutoffs is necessary but not sufficient."
            ),
        }

    failures = []
    if not gpa_ok:
        weak_years = [f"{y:.2f}" for y in best_two if y < 3.70]
        failures.append(
            "GPA: each of your best two years must be ≥ 3.70 individually; "
            + ("year(s) below cutoff: " + ", ".join(weak_years) if weak_years else "requirement not met")
        )
    if not mcat_ok:
        failures.append("MCAT section(s) below 126: " + ", ".join(failed_mcat))

    return {
        "status": "Likely not eligible",
        "explanation": (
            "You do not pass Western's initial screen because "
            + "; ".join(failures)
            + ". "
            "Western is a multi-stage filter: without clearing these academic gates, you will not "
            "proceed to Kira Talent or panel interviews. Address the failed criterion(s) before reapplying."
        ),
    }


def queens(applicant):
    gpa, _, _ = process_gpa(applicant)
    gpa_ok = gpa >= 3.0
    mcat_ok = all(score >= 125 for score in mcat_values(applicant))
    casper_ok = applicant["casper_percentile"] >= 35

    if gpa_ok and mcat_ok and casper_ok:
        return {
            "status": "Likely eligible",
            "explanation": (
                f"Your cGPA ({gpa:.2f}), MCAT (all sections ≥ 125), and CASPer meet Queen's minimum "
                "requirements, so you are placed into their interview lottery pool. "
                "Meeting cutoffs does not guarantee an interview: historically, only about 13% of "
                "eligible applicants receive an interview invitation. "
                "Strong experiences can help with the interview but the lottery adds substantial uncertainty."
            ),
        }

    missing = []
    if not gpa_ok:
        missing.append(f"cGPA {gpa:.2f} is below 3.0")
    if not mcat_ok:
        low = [
            f"{MCAT_LABELS[k]} ({applicant['mcat_sections'][k]})"
            for k in MCAT_KEYS
            if applicant["mcat_sections"][k] < 125
        ]
        missing.append("MCAT below 125: " + ", ".join(low))
    if not casper_ok:
        missing.append(
            f"CASPer equivalent below 35th percentile (your mapped score: {applicant['casper_percentile']})"
        )

    return {
        "status": "Likely not eligible",
        "explanation": (
            "You are not eligible for Queen's interview lottery because "
            + "; ".join(missing)
            + ". "
            "All three components (GPA, MCAT, and CASPer) must be satisfied to enter the pool."
        ),
    }


def ottawa(applicant):
    _, _, last3_gpa = process_gpa(applicant)
    gpa_ok = last3_gpa >= 3.8
    casper_ok = applicant["casper_percentile"] >= 75

    region_note = (
        "Note: approximately 70% of seats are reserved for Ottawa-region applicants; "
        "this does not affect your eligibility calculation here."
    )

    if gpa_ok and casper_ok:
        return {
            "status": "Likely eligible",
            "explanation": (
                f"Your last-three-years GPA ({last3_gpa:.2f}) and CASPer meet Ottawa's academic screen. "
                "Eligible files move to holistic file review and ABS screening; many competitive applicants "
                "still do not receive interviews after review. "
                f"{region_note}"
            ),
        }

    missing = []
    if not gpa_ok:
        missing.append(f"last-three-years GPA {last3_gpa:.2f} is below 3.8 (no known accepted cases with a lower GPA)")
    if not casper_ok:
        missing.append(
            f"CASPer below 75th percentile equivalent (your mapped score: {applicant['casper_percentile']})"
        )

    return {
        "status": "Likely not eligible",
        "explanation": (
            "You do not meet Ottawa's initial requirements: "
            + "; ".join(missing)
            + ". "
            f"{region_note}"
        ),
    }


def tmu(applicant):
    gpa, _, _ = process_gpa(applicant)
    gpa_ok = gpa >= 3.5

    peel_note = (
        "Note: TMU has stated preference for applicants with ties to Brampton/Peel; "
        "this is informational only and is not used in this calculation."
    )

    if gpa_ok:
        return {
            "status": "Likely eligible",
            "explanation": (
                f"Your cGPA of {gpa:.2f} meets TMU's academic cutoff (≥ 3.5); no MCAT is required at this stage. "
                "After the GPA screen, applications receive holistic review of essays and ABS. "
                f"{peel_note}"
            ),
        }

    return {
        "status": "Likely not eligible",
        "explanation": (
            f"Your cGPA of {gpa:.2f} is below TMU's 3.5 minimum, so you do not pass the academic cutoff. "
            "Files below this threshold are not advanced to essay and ABS review. "
            f"{peel_note}"
        ),
    }


def mcmaster(applicant):
    gpa, _, _ = process_gpa(applicant)
    cars = applicant["mcat_sections"]["cars"]
    casper = applicant["casper_percentile"]
    required = mcmaster_required_casper(gpa, cars)
    result = check_interview_invite(gpa, cars, casper)

    if result == "Yes":
        return {
            "status": "Likely competitive",
            "explanation": (
                f"McMaster's formula uses your cGPA ({gpa:.2f}), CARS ({cars}), and CASPer "
                f"(mapped percentile {casper}) together. With CARS {cars}, the model requires roughly "
                f"{required} CASPer equivalent; your score meets or exceeds that, so the formula output is favourable. "
                "This result is based solely on the published GPA–CARS–CASPer interaction, not holistic file review."
            ),
        }

    return {
        "status": "Likely not eligible",
        "explanation": (
            f"McMaster's formula uses your cGPA ({gpa:.2f}), CARS ({cars}), and CASPer "
            f"(mapped percentile {casper}) together. With CARS {cars}, the model requires roughly "
            f"{required} CASPer equivalent; your score is below that threshold, so the formula output is unfavourable. "
            "This outcome follows the published calculation only, without additional speculation."
        ),
    }


def evaluate_applicant(applicant):
    return {
        "uoft": uoft(applicant),
        "western": western(applicant),
        "queens": queens(applicant),
        "ottawa": ottawa(applicant),
        "tmu": tmu(applicant),
        "mcmaster": mcmaster(applicant),
    }


if __name__ == "__main__":
    sample_applicant = {
        "cgpa": 3.92,
        "gpa_by_year": [3.85, 3.90, 3.95, 3.98],
        "mcat_sections": {"cp": 128, "cars": 129, "bb": 130, "ps": 127},
        "casper_percentile": 85,
    }

    results = evaluate_applicant(sample_applicant)
    print("Interview eligibility (sample applicant):")
    for school, outcome in results.items():
        print(f"  {school}: {outcome['status']}")
        print(f"    {outcome['explanation']}")
