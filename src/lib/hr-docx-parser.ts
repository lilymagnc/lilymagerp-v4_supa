import * as mammoth from 'mammoth/mammoth.browser';

type UploadedDocumentType = '휴직원' | '퇴직원' | '휴가원';

type ParsedDocxContents = {
  department?: string;
  position?: string;
  name?: string;
  joinDate?: Date;
  startDate?: Date;
  endDate?: Date;
  reason?: string;
  contact?: string;
  handover?: string;
  leaveType?: string;
};

interface ParsedDocxResult {
  documentType: UploadedDocumentType;
  contents?: ParsedDocxContents;
  userName?: string;
}

const KNOWN_LABELS = [
  '소속',
  '직위',
  '성명',
  '입사일',
  '퇴직 예정일',
  '휴직 기간',
  '휴직 중 비상연락처',
  '업무 인수인계자',
  '사유',
  '휴가 종류',
  '휴가 기간',
  '휴가 중 비상연락처',
] as const;

type KnownLabel = (typeof KNOWN_LABELS)[number];

export const detectDocumentTypeFromFileName = (fileName: string): UploadedDocumentType => {
  const lower = fileName.toLowerCase();
  if (lower.includes('퇴직') || lower.includes('퇴직원') || lower.includes('사직')) {
    return '퇴직원';
  }
  if (lower.includes('휴가') || lower.includes('휴가원')) {
    return '휴가원';
  }
  return '휴직원';
};

const normalizeDateString = (value: string) => {
  let result = value
    .replace(/년|월/gi, '-')
    .replace(/일/gi, '')
    .replace(/[.\\/]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^0-9-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-/, '')
    .replace(/-$/, '');

  if (/^\d{8}$/.test(result)) {
    result = `${result.slice(0, 4)}-${result.slice(4, 6)}-${result.slice(6)}`;
  }

  return result;
};

const parseDateValue = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const normalized = normalizeDateString(value.trim());
  if (!normalized) return undefined;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date;
};

const parseDateRange = (value?: string): { startDate?: Date; endDate?: Date } => {
  if (!value) return {};
  const [startRaw, endRaw] = value.split('~').map((part) => part.trim());
  const startDate = parseDateValue(startRaw);
  const endDate = parseDateValue(endRaw);
  return { startDate, endDate };
};

const buildLabelValueMap = (htmlDocument: Document) => {
  const map = new Map<KnownLabel, string>();

  htmlDocument.querySelectorAll('table').forEach((table) => {
    table.querySelectorAll('tr').forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) return;
      const label = cells[0]?.textContent?.trim() as KnownLabel | undefined;
      if (!label || !KNOWN_LABELS.includes(label)) return;
      const value = cells[1]?.textContent?.trim() ?? '';
      map.set(label, value);
    });
  });

  return map;
};

const extractValue = (map: Map<KnownLabel, string>, label: KnownLabel) => {
  const value = map.get(label);
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const parseDocxFile = async (file: File, fallbackType: UploadedDocumentType): Promise<ParsedDocxResult | null> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
    const parser = new DOMParser();
    const htmlDocument = parser.parseFromString(html, 'text/html');
    const textContent = htmlDocument.body?.textContent || '';

    let documentType: UploadedDocumentType = fallbackType;
    if (textContent.includes('퇴직원')) {
      documentType = '퇴직원';
    } else if (textContent.includes('휴가원')) {
      documentType = '휴가원';
    } else if (textContent.includes('휴직원')) {
      documentType = '휴직원';
    }

    const labelValueMap = buildLabelValueMap(htmlDocument);

    const department = extractValue(labelValueMap, '소속');
    const position = extractValue(labelValueMap, '직위');
    const name = extractValue(labelValueMap, '성명');
    const joinDate = documentType === '퇴직원' ? parseDateValue(extractValue(labelValueMap, '입사일')) : undefined;
    const retirementDate = documentType === '퇴직원' ? parseDateValue(extractValue(labelValueMap, '퇴직 예정일')) : undefined;

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (documentType === '휴직원') {
      const { startDate: start, endDate: end } = parseDateRange(extractValue(labelValueMap, '휴직 기간'));
      startDate = start;
      endDate = end;
    } else if (documentType === '휴가원') {
      const { startDate: start, endDate: end } = parseDateRange(extractValue(labelValueMap, '휴가 기간'));
      startDate = start;
      endDate = end;
    }

    if (documentType === '퇴직원' && retirementDate) {
      endDate = retirementDate;
    }

    const reason = extractValue(labelValueMap, '사유');
    const contact = documentType === '휴직원'
      ? extractValue(labelValueMap, '휴직 중 비상연락처')
      : documentType === '휴가원'
        ? extractValue(labelValueMap, '휴가 중 비상연락처')
        : undefined;
    const handover = documentType === '휴직원' ? extractValue(labelValueMap, '업무 인수인계자') : undefined;
    const leaveType = documentType === '휴가원' ? extractValue(labelValueMap, '휴가 종류') : undefined;

    const contents: ParsedDocxContents = {};
    if (department) contents.department = department;
    if (position) contents.position = position;
    if (name) contents.name = name;
    if (joinDate) contents.joinDate = joinDate;
    if (startDate) contents.startDate = startDate;
    if (endDate) contents.endDate = endDate;
    if (reason) contents.reason = reason;
    if (contact) contents.contact = contact;
    if (handover) contents.handover = handover;
    if (leaveType) contents.leaveType = leaveType;

    return {
      documentType,
      contents: Object.keys(contents).length > 0 ? contents : undefined,
      userName: name,
    };
  } catch (error) {
    console.warn('DOCX parsing failed:', error);
    return null;
  }
};

export type { UploadedDocumentType, ParsedDocxContents, ParsedDocxResult };
