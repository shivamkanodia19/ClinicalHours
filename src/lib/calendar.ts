// Generate .ics calendar file content
export interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  url?: string;
}

function formatDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function generateIcsContent(event: CalendarEvent): string {
  const uid = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}@clinicalhours.com`;
  const startDate = formatDate(event.startDate);
  const endDate = event.endDate
    ? formatDate(event.endDate)
    : formatDate(new Date(event.startDate.getTime() + 60 * 60 * 1000)); // Default 1 hour duration

  let description = event.description || "";
  if (event.url) {
    description += description ? "\\n\\n" : "";
    description += `Website: ${event.url}`;
  }

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Clinical Hours//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${startDate}`,
    `DTEND:${endDate}`,
    `SUMMARY:${escapeIcs(event.title)}`,
  ];

  if (event.location) {
    icsLines.push(`LOCATION:${escapeIcs(event.location)}`);
  }

  if (description) {
    icsLines.push(`DESCRIPTION:${escapeIcs(description)}`);
  }

  if (event.url) {
    icsLines.push(`URL:${event.url}`);
  }

  icsLines.push("END:VEVENT", "END:VCALENDAR");

  return icsLines.join("\r\n");
}

export function downloadIcsFile(event: CalendarEvent, filename?: string): void {
  const content = generateIcsContent(event);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `${event.title.replace(/[^a-z0-9]/gi, "-")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// Helper to create a reminder event for an opportunity
export function createOpportunityReminder(
  opportunityName: string,
  reminderDate: Date,
  location?: string,
  description?: string,
  website?: string
): CalendarEvent {
  return {
    title: `Follow up: ${opportunityName}`,
    description: description
      ? `Clinical Opportunity Reminder\n\n${description}`
      : `Reminder to follow up on your clinical opportunity at ${opportunityName}`,
    location,
    startDate: reminderDate,
    url: website,
  };
}
