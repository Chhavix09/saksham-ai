const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export function formatINR(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `₹${inr.format(Math.round(value))}`
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return inr.format(Math.round(value))
}

export function formatINRShort(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`
  return `₹${inr.format(Math.round(value))}`
}

export function formatEMI(value: number): string {
  return `₹${inr.format(Math.round(value))}/month`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export function titleCase(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function slugLabel(key: string): string {
  const map: Record<string, string> = {
    start_business: 'Starting a Business',
    expand_business: 'Expanding a Business',
    agriculture: 'Agriculture / Allied',
    small_enterprise: 'Small Enterprise',
    vehicle_equipment: 'Vehicle / Equipment',
    education: 'Education',
    other: 'Other Need',
    undergraduate: 'Undergraduate',
    postgraduate: 'Postgraduate',
    professional: 'Professional Course',
    vocational: 'Vocational',
    engineering: 'Engineering',
    medical: 'Medical',
  }
  return map[key] ?? titleCase(key)
}

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
]

export const DISTRICTS: Record<string, string[]> = {
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar', 'Bhavnagar', 'Jamnagar'],
  Maharashtra: ['Mumbai City', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad'],
  Karnataka: ['Bengaluru Urban', 'Mysuru', 'Dharwad', 'Belagavi', 'Mangaluru'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli'],
  'Uttar Pradesh': ['Lucknow', 'Varanasi', 'Kanpur', 'Agra', 'Prayagraj'],
  'West Bengal': ['Kolkata', 'Howrah', 'Hooghly', 'North 24 Parganas'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota'],
  Delhi: ['Central Delhi', 'South Delhi', 'New Delhi', 'East Delhi'],
  Punjab: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala'],
  Bihar: ['Patna', 'Gaya', 'Muzaffarpur'],
  Kerala: ['Ernakulam', 'Thiruvananthapuram', 'Kozhikode'],
  Telangana: ['Hyderabad', 'Warangal', 'Karimnagar'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Jabalpur'],
  Odisha: ['Bhubaneswar', 'Cuttack', 'Rourkela'],
  Haryana: ['Gurugram', 'Faridabad', 'Panipat'],
}

export function districtsFor(state?: string): string[] {
  if (!state) return []
  return DISTRICTS[state] ?? []
}