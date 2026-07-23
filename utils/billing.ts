export interface BillItem {
  item: string;
  qty: string;
  rate: string;
}

export interface Bill {
  invoiceNo: number;
  customerName: string;
  paymentStatus: string;
  items: BillItem[];
  total: number;
  createdAt: number;
  date: string;
}

export const createEmptyItems = (count = 30): BillItem[] =>
  Array.from({ length: count }, () => ({
    item: '',
    qty: '',
    rate: '',
  }));

export const normalizeItems = (items: BillItem[] | undefined): BillItem[] => {
  const savedItems = Array.isArray(items) ? items : [];
  const minimumLength = Math.max(30, savedItems.length);

  return [
    ...savedItems.map(item => ({
      item: String(item?.item ?? ''),
      qty: String(item?.qty ?? ''),
      rate: String(item?.rate ?? ''),
    })),
    ...createEmptyItems(Math.max(0, minimumLength - savedItems.length)),
  ];
};

export const parseFiniteNumber = (value: string | number): number => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

export const calculateRowTotal = (
  qty: string | number,
  rate: string | number,
): number =>
  Number((parseFiniteNumber(qty) * parseFiniteNumber(rate)).toFixed(2));

export const isPopulatedItem = (item: BillItem): boolean =>
  Boolean(item.item?.trim() || item.qty?.trim() || item.rate?.trim());

export const isValidNumericInput = (value: string): boolean =>
  value.trim() !== '' && Number.isFinite(Number(value));

export const formatBillTimestamp = (date: Date): string =>
  date.toLocaleString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const buildDateKey = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const extractDateKeyFromString = (
  dateString: string | undefined,
): string | null => {
  if (!dateString) {
    return null;
  }

  const slashMatch = dateString.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const day = String(slashMatch[1]).padStart(2, '0');
    const month = String(slashMatch[2]).padStart(2, '0');
    return `${day}/${month}/${slashMatch[3]}`;
  }

  const dashMatch = dateString.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dashMatch) {
    const day = String(dashMatch[1]).padStart(2, '0');
    const month = String(dashMatch[2]).padStart(2, '0');
    return `${day}/${month}/${dashMatch[3]}`;
  }

  return null;
};

export const getBillDateKey = (
  bill: Pick<Bill, 'date' | 'createdAt'>,
): string | null => {
  const dateFromLabel = extractDateKeyFromString(bill.date);
  if (dateFromLabel) {
    return dateFromLabel;
  }

  const createdAt = Number(bill.createdAt);
  if (!Number.isFinite(createdAt) || createdAt <= 0) {
    return null;
  }

  const createdDate = new Date(createdAt);
  return Number.isNaN(createdDate.getTime()) ? null : buildDateKey(createdDate);
};

export const escapeHtml = (value: string | number): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
