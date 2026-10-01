import type { Division, TimetableSlot } from '../types/timetable';

/**
 * Extracts the single primary division letter/identifier (e.g., "Division Q" -> "Q", "CSE-A" -> "A")
 */
export function getDivisionLetter(divName?: string): string {
  if (!divName) return '';
  const trimmed = divName.trim();

  // Try matching "Division X" or "Div X" or "Sec X"
  const prefixMatch = trimmed.match(/(?:Division|Div|Section|Sec)\s*[-:]?\s*([A-Za-z0-9]+)/i);
  if (prefixMatch) return prefixMatch[1].toUpperCase();

  // Try matching single standalone letter like "Q" or "A"
  const singleMatch = trimmed.match(/\b([A-Za-z])\b/);
  if (singleMatch) return singleMatch[1].toUpperCase();

  // Or if it's something like "CSE-3Q"
  const trailingMatch = trimmed.match(/[-_\s]([A-Za-z0-9]+)$/);
  if (trailingMatch) return trailingMatch[1].toUpperCase();

  return '';
}

/**
 * Normalizes batch strings (e.g., "1" with Division Q -> "Q1", "deco-1" -> "Q1", "Q1" -> "Q1")
 */
export function standardizeBatchName(batch: string, divName?: string): string {
  if (!batch || batch.trim().toLowerCase() === 'all') return 'All';
  const clean = batch.trim();

  const divLetter = getDivisionLetter(divName);

  // If already like "Q1", "A2", "B3" and matches divLetter
  if (divLetter && clean.toUpperCase().startsWith(divLetter)) {
    return clean.toUpperCase();
  }

  // If it's a pure number like "1", "2", "3"
  if (/^\d+$/.test(clean)) {
    return divLetter ? `${divLetter}${clean}` : `Group ${clean}`;
  }

  // If it's "Group 1", "Batch 1"
  const groupMatch = clean.match(/(?:Group|Batch|B|G)\s*[-:]?\s*(\d+)/i);
  if (groupMatch) {
    const num = groupMatch[1];
    return divLetter ? `${divLetter}${num}` : `Group ${num}`;
  }

  return clean;
}

/**
 * Automatically inspects a subject code/name for practical group numbers like "DECO-1", "CN-2"
 * and returns clean subject code, clean name, type, and standardized batch.
 */
export function detectSlotBatch(
  rawCode: string,
  rawName: string,
  existingBatch?: string,
  divName?: string
): {
  subjectCode: string;
  subjectName: string;
  batch?: string;
  isLab: boolean;
} {
  const code = (rawCode || '').trim();
  const name = (rawName || '').trim();
  const divLetter = getDivisionLetter(divName);

  // If an explicit batch is already provided
  if (existingBatch && existingBatch.trim().toLowerCase() !== 'all') {
    return {
      subjectCode: code,
      subjectName: name,
      batch: standardizeBatchName(existingBatch, divName),
      isLab: true,
    };
  }

  // Check code or name for patterns like "DECO-1", "DECO - 1", "DECO 1", "CN-2", "DBMS-Q1"
  // Note: We require a separator (-, _, or space) so real course codes like "CS301", "AM102" are untouched!
  const regex = /^(.+?)[-_\s]+([A-Za-z]?\d+)[\)\]]?$/i;
  const matchCode = code.match(regex);
  const matchName = name.match(regex);

  const match = matchCode || matchName;

  if (match) {
    const baseSubject = (matchCode ? matchCode[1] : matchName![1]).trim();
    const groupSuffix = (matchCode ? matchCode[2] : matchName![2]).trim();

    // Standardize batch
    let batchName = groupSuffix;
    if (/^\d+$/.test(groupSuffix)) {
      batchName = divLetter ? `${divLetter}${groupSuffix}` : `Group ${groupSuffix}`;
    } else if (divLetter && !groupSuffix.toUpperCase().startsWith(divLetter)) {
      batchName = `${divLetter}${groupSuffix.replace(/^[A-Za-z]/, '')}`;
    }

    const cleanCode = baseSubject;
    // If name was just the same as code or had suffix, clean it
    let cleanName = name;
    if (cleanName.toLowerCase().startsWith(baseSubject.toLowerCase())) {
      cleanName = `${baseSubject} Lab`;
    }

    return {
      subjectCode: cleanCode,
      subjectName: cleanName,
      batch: standardizeBatchName(batchName, divName),
      isLab: true,
    };
  }

  return {
    subjectCode: code,
    subjectName: name,
    batch: existingBatch,
    isLab: false,
  };
}

/**
 * Returns all unique groups present in a division's slots (e.g. ['Q1', 'Q2', 'Q3', 'Q4'])
 */
export function getDivisionGroups(division?: Division): string[] {
  if (!division || !division.slots) return [];
  const groupsSet = new Set<string>();

  for (const slot of division.slots) {
    if (slot.batch && slot.batch.trim().toLowerCase() !== 'all') {
      const std = standardizeBatchName(slot.batch, division.name);
      groupsSet.add(std);
    }
  }

  return Array.from(groupsSet).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
}

/**
 * Checks whether a given slot belongs to the selected lab group/batch.
 * Common lectures (batch 'All' or unset) match ALL groups!
 */
export function isSlotInGroup(slot: TimetableSlot, selectedGroup: string, divName?: string): boolean {
  if (!selectedGroup || selectedGroup.toLowerCase() === 'all') {
    return true;
  }

  // Common lecture attended by the entire division
  if (!slot.batch || slot.batch.trim().toLowerCase() === 'all') {
    return true;
  }

  const slotGroupStd = standardizeBatchName(slot.batch, divName).toLowerCase();
  const selectedGroupStd = standardizeBatchName(selectedGroup, divName).toLowerCase();

  return slotGroupStd === selectedGroupStd;
}

/**
 * Filters a division's slots by selected group, preserving common lectures.
 */
export function filterDivisionByGroup(division: Division, selectedGroup: string): Division {
  if (!selectedGroup || selectedGroup.toLowerCase() === 'all') {
    return division;
  }

  const filteredSlots = division.slots.filter((slot) =>
    isSlotInGroup(slot, selectedGroup, division.name)
  );

  return {
    ...division,
    slots: filteredSlots,
  };
}
