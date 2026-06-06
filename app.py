from flask import Flask, render_template, request, redirect, flash, get_flashed_messages

from engine import evaluate_applicant

import csv
import os

app = Flask(__name__)
app.secret_key = "dev-secret-key"

SCHOOL_LABELS = {
    "uoft": "UofT",
    "western": "Western",
    "queens": "Queen's",
    "ottawa": "Ottawa",
    "tmu": "TMU",
    "mcmaster": "McMaster",
}

CASPER_QUARTILE_MAP = {
    "Q1": 13,
    "Q2": 38,
    "Q3": 63,
    "Q4": 88,
}


def parse_gpa_by_year(raw_value):
    """Convert optional comma-separated GPA years into a list of floats."""
    if not raw_value or not str(raw_value).strip():
        return None
    return [float(year.strip()) for year in str(raw_value).split(",") if year.strip()]


def casper_percentile_from_quartile(quartile):
    return CASPER_QUARTILE_MAP[quartile]


def applicant_from_form(form):
    """Build an applicant dict from submitted form data."""
    applicant = {
        "cgpa": float(form["cgpa"]),
        "mcat_sections": {
            "cp": int(form["cp"]),
            "cars": int(form["cars"]),
            "bb": int(form["bb"]),
            "ps": int(form["ps"]),
        },
        "casper_percentile": casper_percentile_from_quartile(form["casper_quartile"]),
    }

    gpa_by_year = parse_gpa_by_year(form.get("gpa_by_year", ""))
    if gpa_by_year is not None:
        applicant["gpa_by_year"] = gpa_by_year

    return applicant


def format_results(raw_results):
    """Map engine output to display rows for the template."""
    return [
        {
            "name": SCHOOL_LABELS[key],
            "status": raw_results[key]["status"],
            "explanation": raw_results[key]["explanation"],
        }
        for key in ("uoft", "western", "queens", "ottawa", "tmu", "mcmaster")
    ]


def form_values_for_template(form):
    """Preserve user input when re-rendering the form after POST."""
    if not form:
        return None
    return {
        "cgpa": form.get("cgpa", ""),
        "gpa_by_year": form.get("gpa_by_year", ""),
        "cp": form.get("cp", ""),
        "cars": form.get("cars", ""),
        "bb": form.get("bb", ""),
        "ps": form.get("ps", ""),
        "casper_quartile": form.get("casper_quartile", "Q3"),
    }


@app.route("/", methods=["GET", "POST"])
def index():
    results = None
    form_values = None

    if request.method == "POST":
        applicant = applicant_from_form(request.form)
        results = format_results(evaluate_applicant(applicant))
        form_values = form_values_for_template(request.form)

    return render_template(
        "index.html",
        results=results,
        form_values=form_values,
        casper_options=["Q1", "Q2", "Q3", "Q4"],
    )


import requests

GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwNGH8fV31HIVc9B0iph1JXHbYLc3ZWy08WzcRlkF5wRK9VbzD559qNYRjp394Gh-9lfw/exec"

@app.route("/subscribe", methods=["POST"])
def subscribe():
    email = request.form.get("email")

    requests.post(GOOGLE_SCRIPT_URL, json={
        "email": email
    })

    return "ok"


if __name__ == "__main__":
    app.run(debug=True)


