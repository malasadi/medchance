// ─────────────────────────────────────────────
//  App — DOM interaction, form handling, rendering
//  Depends on: engine.js (must be loaded first)
// ─────────────────────────────────────────────

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwNGH8fV31HIVc9B0iph1JXHbYLc3ZWy08WzcRlkF5wRK9VbzD559qNYRjp394Gh-9lfw/exec";

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

document.getElementById("eligibility-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const btn = document.getElementById("submit-btn");
  btn.classList.add("loading");

  // Fire email silently if provided
  maybeSubmitEmail(document.getElementById("email-input").value);

  // Small delay for perceived responsiveness
  setTimeout(() => {
    try {
      const applicant = buildApplicant(this);
      const schools = evaluateApplicant(applicant);
      renderResults(schools);
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please check your inputs and try again.");
    } finally {
      btn.classList.remove("loading");
    }
  }, 280);
});
