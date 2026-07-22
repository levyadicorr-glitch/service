"""Minimal Flask app to preview the design-system templates with real data
shapes. Run:

    pip install -r requirements.txt
    python app.py

Then open http://127.0.0.1:5000/
"""
from dataclasses import dataclass
from flask import Flask, render_template

app = Flask(__name__)

REGIONS = [
    {"key": "CENTER", "label": "מרכז"},
    {"key": "SOUTH", "label": "דרום"},
    {"key": "NORTH", "label": "צפון"},
    {"key": "JERUSALEM", "label": "ירושלים"},
]


@dataclass
class Customer:
    id: str
    first_name: str
    last_name: str
    phone: str = ""
    address: str = ""
    region: str = ""


CUSTOMERS = [
    Customer("1", "ישראל", "ישראלי", "052-1234567", "דרך מנחם בגין 121, תל אביב", "CENTER"),
    Customer("2", "דנה", "כהן", "054-9876543", "", ""),
    Customer("3", "משה", "לוי", "050-1112223", "הרצל 8, באר שבע", "SOUTH"),
]


@app.route("/")
def index():
    # Jinja has no list-comprehension syntax — build option lists like this
    # in the view, not inline in the template.
    region_options = [(r["key"], r["label"], "cyan") for r in REGIONS] + [("", "ללא אזור", "gray")]
    return render_template(
        "example_page.html",
        customers=CUSTOMERS,
        regions=REGIONS,
        region_options=region_options,
    )


if __name__ == "__main__":
    app.run(debug=True)
