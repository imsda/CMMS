import { escapeHtml } from "../html";

export type DirectorReadinessReminderTemplateProps = {
  clubName: string;
  monthLabel: string;
  items: string[];
};

export function buildDirectorReadinessReminderHtml(input: DirectorReadinessReminderTemplateProps) {
  const renderedItems = input.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  return `
    <h1>${escapeHtml(input.clubName)} readiness reminder</h1>
    <p>Here are the current items needing attention for ${escapeHtml(input.monthLabel)}:</p>
    <ul>${renderedItems}</ul>
  `;
}
