// A generation job's steps, in order, as the worker reports them in job.progress.step.
const STEPS = [
  { key: "cloning", label: "Cloning repository" },
  { key: "planning", label: "Planning the docs" },
  { key: "writing", label: "Writing pages" },
  { key: "building", label: "Building the site" },
];
const STEP_INDEX = { starting: 0, cloning: 0, planning: 1, writing: 2, saving: 2, building: 3, done: 4 };

// "Retrying in 30s (attempt 2 of 3)", "Waiting for a worker", "Writing "Quickstart""...
function currentMessage(job) {
  return job?.progress?.message || (job?.status === "queued" ? "Waiting for a worker" : "Starting");
}

/** The checklist of steps with the worker's live message under the active one. */
export function JobSteps({ job, colors = {} }) {
  const heading = colors.heading || "var(--text-heading, #111827)";
  const muted = colors.muted || "var(--text-muted, #6b7280)";
  const border = colors.border || "var(--border-color, #d1d5db)";
  const accent = colors.accent || "var(--primary-brand, #10b981)";

  const queued = !job || job.status === "queued";
  const active = queued ? -1 : STEP_INDEX[job.progress?.step] ?? 0;
  const { pagesDone, pagesTotal } = job?.progress || {};

  return (
    <div data-testid="job-steps" style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%", maxWidth: "340px" }}>
      {queued && (
        <div data-testid="job-queued" style={{ fontSize: "13px", color: muted, textAlign: "center" }}>
          {currentMessage(job)}
        </div>
      )}
      {STEPS.map((step, index) => {
        const isCompleted = index < active;
        const isActive = index === active;
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "flex-start", gap: "12px", opacity: isCompleted || isActive ? 1 : 0.4, transition: "opacity 0.3s" }}>
            <div style={{
              width: "20px", height: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              backgroundColor: isCompleted ? heading : "transparent",
              border: isCompleted ? "none" : isActive ? `2px solid ${heading}` : `2px dashed ${border}`,
            }}>
              {isCompleted && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: "14px", fontWeight: isActive ? 600 : 500, color: heading }}>
                {step.label}
                {isActive && step.key === "writing" && pagesTotal ? ` (${Math.min(pagesDone + 1, pagesTotal)} of ${pagesTotal})` : ""}
              </span>
              {isActive && (
                <div data-testid="job-message" style={{ fontSize: "12px", color: muted, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {currentMessage(job)}
                </div>
              )}
              {isActive && step.key === "writing" && pagesTotal > 0 && (
                <div style={{ height: "4px", backgroundColor: "#e5e7eb", borderRadius: "2px", marginTop: "6px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round((pagesDone / pagesTotal) * 100)}%`, backgroundColor: accent, transition: "width 0.4s" }} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
