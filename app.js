// ─────────────────────────────────────────────
//  App — DOM interaction, form handling, rendering
//  Depends on: engine.js (must be loaded first)
// ─────────────────────────────────────────────

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwNGH8fV31HIVc9B0iph1JXHbYLc3ZWy08WzcRlkF5wRK9VbzD559qNYRjp394Gh-9lfw/exec";

// ─────────────────────────────────────────────
//  Validation
// ─────────────────────────────────────────────

const REQUIRED_FIELDS = [
  { id: "cgpa",  label: "cGPA",  min: 0,   max: 4,   step: 0.01 },
  { id: "cp",   label: "CP",   min: 118, max: 132, step: 1 },
  { id: "cars", label: "CARS", min: 118, max: 132, step: 1 },
  { id: "bb",   label: "BB",   min: 118, max: 132, step: 1 },
  { id: "ps",   label: "PS",   min: 118, max: 132, step: 1 },
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
    mcat_sections: {
      cp:   parseInt(data.get("cp"),   10),
      cars: parseInt(data.get("cars"), 10),
      bb:   parseInt(data.get("bb"),   10),
      ps:   parseInt(data.get("ps"),   10),
    },
    casper_percentile: CASPER_QUARTILE_MAP[data.get("casper_quartile")],
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

function renderResults(schools) {
  const list = document.getElementById("results-list");
  list.innerHTML = schools.map(({ name, result }) => `
    <article class="result-card ${result.type}">
      <div class="result-card-header">
        <h3>${name}</h3>
        <span class="badge ${badgeClass(result.type)}">${result.status}</span>
      </div>
      <p class="explanation">${result.explanation}</p>
    </article>
  `).join("");

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

function maybeSubmitEmail(email) {
  if (!email || !email.trim()) return;
  fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim() }),
  }).catch(() => {});
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
  }, 500);
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

  // Show loading spinner
  submitBtn.classList.add("loading");

  // Submit email silently
  maybeSubmitEmail(email);

  // Calculate and display results after a short delay
  setTimeout(() => {
    try {
      const applicant = buildApplicant(eligibilityForm);
      const schools = evaluateApplicant(applicant);
      renderResults(schools);
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please check your inputs and try again.");
    } finally {
      submitBtn.classList.remove("loading");
    }
  }, 280);
});

