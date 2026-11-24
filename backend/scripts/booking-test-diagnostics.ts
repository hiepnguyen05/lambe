type Assertion = {
  fullName?: string;
  status?: string;
  duration?: number | null;
  failureMessages?: string[];
};

type JestResults = {
  testResults?: { assertionResults?: Assertion[] }[];
};

function failureKind(messages: string[]): string {
  const details = messages.join('\n');
  const prismaCode = details.match(/\bP\d{4}\b/);
  if (prismaCode) return `prisma_${prismaCode[0]}`;
  const http = details.match(/expected (\d{3}) [^\n]*?got (\d{3})/i);
  if (http) return `http_expected_${http[1]}_got_${http[2]}`;
  if (/exceeded timeout|timeout - async callback|test timed out/i.test(details))
    return 'test_timeout';
  if (/ECONNRESET|socket hang up/i.test(details)) return 'connection_reset';
  if (/ENOTFOUND|EAI_AGAIN/i.test(details)) return 'dns_failure';
  if (/ECONNREFUSED/i.test(details)) return 'connection_refused';
  if (/deadlock detected/i.test(details)) return 'database_deadlock';
  if (/PrismaClientInitializationError/i.test(details))
    return 'prisma_initialization';
  return 'assertion_or_other';
}

// Jest names come from source, but the list is fixed to the booking suite only.
// Never copy raw Jest failure messages into CLI output: Prisma can include URLs.
export function bookingFailures(report: JestResults): {
  test: string;
  durationMs: number | null;
  kind: string;
}[] {
  return (report.testResults ?? [])
    .flatMap((suite) => suite.assertionResults ?? [])
    .filter((assertion) => assertion.status === 'failed')
    .map((assertion) => ({
      test: String(assertion.fullName ?? 'unknown')
        .replace(/(?:postgres(?:ql)?|redis(?:s)?):\/\/\S+/gi, '[redacted-url]')
        .slice(0, 240),
      durationMs:
        typeof assertion.duration === 'number' ? assertion.duration : null,
      kind: failureKind(assertion.failureMessages ?? []),
    }));
}
