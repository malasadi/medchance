// ─────────────────────────────────────────────
//  App — DOM interaction, form handling, rendering
//  Depends on: engine.js (must be loaded first)
// ─────────────────────────────────────────────

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyVeF6D9muzkSJKh4l3oSAQg4t6dj2-khcnzjswB5NR28FDc8rFgkbu6xMAPGDF1gY9xw/exec";

// ─────────────────────────────────────────────
//  Validation
// ─────────────────────────────────────────────

const REQUIRED_FIELDS = [
  { id: "cgpa", label: "cGPA", min: 0, max: 4, step: 0.01 },
  { id: "cp", label: "CP", min: 118, max: 132, step: 1 },
  { id: "cars", label: "CARS", min: 118, max: 132, step: 1 },
  { id: "bb", label: "BB", min: 118, max: 132, step: 1 },
  { id: "ps", label: "PS", min: 118, max: 132, step: 1 },
];

function setFieldError(el, msg) {
  el.classList.add("field-error");
  let errEl = el.parentElement.querySelector(".field-error-msg");
  if (!errEl) {
    errEl = document.createElement("span");
    errEl.className = "field-error-msg";
    el.parentElement.appendChild(errEl);
  }
  errEl.textContent = msg;
}

function clearFieldError(el) {
  el.classList.remove("field-error");
  const errEl = el.parentElement.querySelector(".field-error-msg");
  if (errEl) errEl.remove();
}

function validateForm() {
  let valid = true;
  let firstBad = null;

  // Clear MCAT box-level error first
  const mcatBox = document.querySelector(".fieldset-box");

  for (const field of REQUIRED_FIELDS) {
    const el = document.getElementById(field.id);
    const val = el.value.trim();

    if (val === "" || isNaN(Number(val))) {
      setFieldError(el, `${field.label} is required.`);
      valid = false;
      if (!firstBad) firstBad = el;
    } else {
      const num = Number(val);
      if (num < field.min || num > field.max) {
        setFieldError(el, `${field.label} must be ${field.min}–${field.max}.`);
        valid = false;
        if (!firstBad) firstBad = el;
      } else {
        clearFieldError(el);
      }
    }
  }

  // Highlight MCAT fieldset-box if any MCAT field failed
  const mcatIds = ["cp", "cars", "bb", "ps"];
  const anyMcatError = mcatIds.some(id => document.getElementById(id).classList.contains("field-error"));
  if (mcatBox) {
    mcatBox.classList.toggle("field-error", anyMcatError);
  }

  if (firstBad) {
    firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
    firstBad.focus();
  }

  return valid;
}

// ─────────────────────────────────────────────
//  Form helpers
// ─────────────────────────────────────────────

function parseGpaByYear(raw) {
  if (!raw || !raw.trim()) return null;
  return raw.split(",").map(s => s.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n));
}

function buildApplicant(form) {
  const data = new FormData(form);
  const applicant = {
    cgpa: parseFloat(data.get("cgpa")),
    aGpa: (() => {
      const val = data.get("agpa");
      if (val === null || val.trim() === "") return null;
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    })(),
    mcat_sections: {
      cp: parseInt(data.get("cp"), 10),
      cars: parseInt(data.get("cars"), 10),
      bb: parseInt(data.get("bb"), 10),
      ps: parseInt(data.get("ps"), 10),
    },
    casper_percentile: CASPER_QUARTILE_MAP[data.get("casper_quartile")],
    province: data.get("province") ? data.get("province").trim() : "",
    graduate_degree: data.get("graduate_degree") || "none",
    intent_stage: data.get("intent_stage") || "planning"
  };
  const years = parseGpaByYear(data.get("gpa_by_year"));
  if (years) applicant.gpa_by_year = years;
  return applicant;
}

// ─────────────────────────────────────────────
//  Render results
// ─────────────────────────────────────────────

function badgeClass(type) {
  if (type === "eligible" || type === "competitive") return "badge-eligible";
  return "badge-not-eligible";
}

const ONTARIO_SCHOOLS = new Set(["UofT", "Western", "Queen's", "Ottawa", "TMU", "McMaster"]);

function renderResults(schools, province = "") {
  const list = document.getElementById("results-list");
  list.innerHTML = schools.map(({ name, result }) => {
    let warning = "";

    if (ONTARIO_SCHOOLS.has(name)) {
      if (province !== "Ontario") {
        warning += `<p class=\"warning-warning\">This school gives strong preference to Ontario residents (approx. 95% seats).</p>`;
      }
      if (name === "Ottawa") {
        warning += `<p class=\"warning-warning\">70% of seats are reserved for applicants from the Ottawa and surrounding regions.</p>`;
      }
      if (name === "TMU") {
        warning += `<p class=\"warning-warning\">Strong preference is given for applicants from the Peel/Brampton regions.</p>`;
      }
    }

    if (name === "UBC") {
      if (province !== "British Columbia") {
        warning += `<p class=\"warning-warning\">90% of seats are reserved for applicants from BC.</p>`;
      }
    }

    if (name === "SFU") {
      warning += `<p class=\"warning-warning\">SFU is currently only open to applicants from BC and the Canadian territories (Nunavut, Yukon, and Northwest Territories).</p>`;
    }

    if (name === "UCalgary") {
      if (province !== "Alberta") {
        warning += `<p class="warning-warning">UCalgary reserves roughly 85% of its seats for Alberta residents.</p>`;
      }
    }

    if (name === "McGill") {
      if (province !== "Quebec") {
        warning += `<p class=\"warning-warning\">5 - 11 seats are available to out-of-province applicants per year, with the rest reserved for Quebec residents.</p>`;
      }
    }

    return `
    <article class=\"result-card ${result.type}\">
      <div class=\"result-card-header\">
        <h3>${name}</h3>
        <span class=\"badge ${badgeClass(result.type)}\">${result.status}</span>
      </div>
      <p class=\"explanation\">${result.explanation}</p>
      ${warning}
    </article>
  `;
  }).join("");

  const section = document.getElementById("results-section");
  section.style.display = "block";
  // Force reflow then animate
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      section.classList.add("visible");
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

// ─────────────────────────────────────────────
//  Silent email subscribe (fires on eligibility submit if email entered)
// ─────────────────────────────────────────────

function maybeSubmitEmail(email, applicant, results) {
  if (!email || !email.trim()) return;

  const payload = { email: email.trim() };

  if (
    applicant &&
    applicant.province &&
    typeof applicant.cgpa === 'number' && !isNaN(applicant.cgpa) &&
    applicant.casper_percentile !== undefined &&
    applicant.mcat_sections &&
    typeof applicant.mcat_sections.cp === 'number' &&
    typeof applicant.mcat_sections.cars === 'number' &&
    typeof applicant.mcat_sections.bb === 'number' &&
    typeof applicant.mcat_sections.ps === 'number'
  ) {
    payload.province = applicant.province;
    payload.cGPA = applicant.cgpa;
    payload.casper_quartile = applicant.casper_percentile;
    payload.mcat_cp = applicant.mcat_sections.cp;
    payload.mcat_cars = applicant.mcat_sections.cars;
    payload.mcat_bb = applicant.mcat_sections.bb;
    payload.mcat_ps = applicant.mcat_sections.ps;
    payload.intent_stage = applicant.intent_stage || "";
  }

  // =========================
  // 1. SEND TO GOOGLE SHEETS (existing, unchanged)
  // =========================
  fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => { });

  // =========================
  // 2. SEND TO RESEND WORKER (NEW)
  // =========================
  const resultsHtml = formatResultsForEmail(results);

  fetch("https://medchance-emails.mohammeasadi.workers.dev", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: email.trim(),
      results: resultsHtml
    })
  })
    .then(() => {
      console.log("Email sent via Worker");
    })
    .catch((err) => {
      console.error("Worker email failed:", err);
    });
}

function formatResultsForEmail(results) {
  if (!results || !Array.isArray(results)) return "";

  function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  let html = '<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">';
  for (const school of results) {
    html += `<h3 style=\"color: #007acc;\">${escapeHtml(school.name)}</h3>`;
    html += `<p style=\"margin-top: 0; margin-bottom: 15px;\">${escapeHtml(school.result.explanation)}</p>`;
  }
  html += '</div>';
  return html;
}

// ─────────────────────────────────────────────
//  Form submit
// ─────────────────────────────────────────────

const eligibilityForm = document.getElementById("eligibility-form");
const emailModal = document.getElementById("email-modal");
const emailForm = document.getElementById("email-form");
const modalEmailInput = document.getElementById("modal-email-input");
const emailError = document.getElementById("email-error");
const submitBtn = document.getElementById("submit-btn");

eligibilityForm.addEventListener("submit", function (e) {
  e.preventDefault();

  // Validate only the academic fields, excluding email
  if (!validateForm()) return;

  // Check if email has been collected before
  if (localStorage.getItem("emailCollected") === "true") {
    // Immediately calculate and display results without popup
    submitBtn.classList.add("loading");
    setTimeout(() => {
      try {
        const applicant = buildApplicant(eligibilityForm);
        const schools = evaluateApplicant(applicant);
        renderResults(schools, applicant.province);
      } catch (err) {
        console.error(err);
        alert("Something went wrong. Please check your inputs and try again.");
      } finally {
        submitBtn.classList.remove("loading");
      }
    }, 280);
    return;
  }

  // Show loading spinner on button
  submitBtn.classList.add("loading");

  // Delay before showing email modal
  setTimeout(() => {
    // Hide loading spinner
    submitBtn.classList.remove("loading");

    // Show modal for email input
    emailModal.setAttribute("aria-hidden", "false");
    emailModal.style.display = "flex";
    modalEmailInput.value = "";
    emailError.style.display = "none";
    modalEmailInput.focus();
  }, 2000);
});



// Validate email format (basic)
function isValidEmail(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

emailForm.addEventListener("submit", function (e) {
  e.preventDefault();

  const email = modalEmailInput.value.trim();
  if (!email) {
    emailError.textContent = "Email is required.";
    emailError.style.display = "block";
    modalEmailInput.focus();
    return;
  }
  if (!isValidEmail(email)) {
    emailError.textContent = "Please enter a valid email address.";
    emailError.style.display = "block";
    modalEmailInput.focus();
    return;
  }

  // Hide modal
  emailModal.setAttribute("aria-hidden", "true");
  emailModal.style.display = "none";

  // Mark email as collected in localStorage
  localStorage.setItem("emailCollected", "true");

  // Show loading spinner
  submitBtn.classList.add("loading");

  // Build applicant and results
  const applicant = buildApplicant(eligibilityForm);
  const schools = evaluateApplicant(applicant);

  // Append region-specific notes inline to each school's explanation in email results
  const ONTARIO_SCHOOLS = new Set(["UofT", "Western", "Queen's", "Ottawa", "TMU", "McMaster"]);
  const BC_SCHOOLS = new Set(["UBC"]);

  for (const school of schools) {
    let regionNote = "";
    if (ONTARIO_SCHOOLS.has(school.name)) {
      regionNote += "This school gives strong preference to Ontario residents (approx. 95% seats).";
      if (school.name === "Ottawa") {
        regionNote += " 70% of seats are reserved for applicants from the Ottawa and surrounding regions.";
      }
      if (school.name === "TMU") {
        regionNote += " Strong preference is given for applicants from the Peel/Brampton regions.";
      }
    } else if (BC_SCHOOLS.has(school.name)) {
      regionNote += "90% of seats are reserved for applicants from BC.";
    } else if (school.name === "UCalgary") {
      regionNote += "UCalgary reserves roughly 85% of its seats for Alberta residents.";
    }

    if (regionNote) {
      // Append inline with a space separator
      school.result.explanation += " " + regionNote;
    }
  }

  // Submit email silently with applicant details and modified results
  maybeSubmitEmail(email, applicant, schools);

  // Calculate and display results after a short delay
  setTimeout(() => {
    try {
      renderResults(schools, applicant.province);
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please check your inputs and try again.");
    } finally {
      submitBtn.classList.remove("loading");
    }
  }, 280);
});



