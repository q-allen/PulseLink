// Specialties, Conditions, Services, Hospitals, HMOs for NowServing clone

export const topSpecialties = [
  { id: 'internal-medicine', name: 'Internal Medicine', icon: 'Stethoscope', count: 156 },
  { id: 'pediatrics', name: 'Pediatrics', icon: 'Baby', count: 124 },
  { id: 'ob-gyn', name: 'OB-Gynecology', icon: 'Heart', count: 98 },
  { id: 'dermatology', name: 'Dermatology', icon: 'Sparkles', count: 87 },
  { id: 'cardiology', name: 'Cardiology', icon: 'HeartPulse', count: 76 },
  { id: 'orthopedics', name: 'Orthopedics', icon: 'Bone', count: 65 },
  { id: 'ophthalmology', name: 'Ophthalmology', icon: 'Eye', count: 54 },
  { id: 'ent', name: 'ENT', icon: 'Ear', count: 48 },
  { id: 'psychiatry', name: 'Psychiatry', icon: 'Brain', count: 42 },
  { id: 'neurology', name: 'Neurology', icon: 'Brain', count: 38 },
  { id: 'pulmonology', name: 'Pulmonology', icon: 'Wind', count: 34 },
  { id: 'gastroenterology', name: 'Gastroenterology', icon: 'Activity', count: 29 },
];

export const commonConditions = [
  { id: 'hypertension', name: 'Hypertension', specialty: 'Cardiology' },
  { id: 'diabetes', name: 'Diabetes', specialty: 'Internal Medicine' },
  { id: 'asthma', name: 'Asthma', specialty: 'Pulmonology' },
  { id: 'allergies', name: 'Allergies', specialty: 'Internal Medicine' },
  { id: 'back-pain', name: 'Back Pain', specialty: 'Orthopedics' },
  { id: 'acne', name: 'Acne', specialty: 'Dermatology' },
  { id: 'anxiety', name: 'Anxiety', specialty: 'Psychiatry' },
  { id: 'depression', name: 'Depression', specialty: 'Psychiatry' },
  { id: 'migraine', name: 'Migraine', specialty: 'Neurology' },
  { id: 'uti', name: 'UTI', specialty: 'Internal Medicine' },
  { id: 'pregnancy', name: 'Pregnancy Care', specialty: 'OB-Gynecology' },
  { id: 'flu', name: 'Flu & Cold', specialty: 'Internal Medicine' },
];

export const commonServices = [
  { id: 'consultation', name: 'General Consultation', price: 'From ₱500' },
  { id: 'teleconsult', name: 'Teleconsultation', price: 'From ₱300' },
  { id: 'annual-checkup', name: 'Annual Physical Exam', price: 'From ₱2,500' },
  { id: 'prenatal', name: 'Prenatal Checkup', price: 'From ₱800' },
  { id: 'vaccination', name: 'Vaccination', price: 'From ₱500' },
  { id: 'lab-tests', name: 'Laboratory Tests', price: 'From ₱200' },
  { id: 'xray', name: 'X-Ray', price: 'From ₱500' },
  { id: 'ultrasound', name: 'Ultrasound', price: 'From ₱1,000' },
];

export const hospitals = [
  { id: 'mmc', name: 'Manila Medical Center', location: 'Manila', doctorCount: 45 },
  { id: 'stlukes-bgc', name: "St. Luke's Medical Center - BGC", location: 'Taguig', doctorCount: 82 },
  { id: 'stlukes-qc', name: "St. Luke's Medical Center - QC", location: 'Quezon City', doctorCount: 78 },
  { id: 'medical-city', name: 'The Medical City', location: 'Pasig', doctorCount: 95 },
  { id: 'makati-med', name: 'Makati Medical Center', location: 'Makati', doctorCount: 67 },
  { id: 'asian-hospital', name: 'Asian Hospital', location: 'Muntinlupa', doctorCount: 54 },
  { id: 'pgh', name: 'Philippine General Hospital', location: 'Manila', doctorCount: 120 },
  { id: 'cardinal', name: 'Cardinal Santos Medical Center', location: 'San Juan', doctorCount: 48 },
];

export const hmos = [
  { id: 'maxicare', name: 'Maxicare', logo: '/hmo/maxicare.png' },
  { id: 'intellicare', name: 'Intellicare', logo: '/hmo/intellicare.png' },
  { id: 'medicard', name: 'Medicard', logo: '/hmo/medicard.png' },
  { id: 'philcare', name: 'PhilCare', logo: '/hmo/philcare.png' },
  { id: 'cocolife', name: 'Cocolife', logo: '/hmo/cocolife.png' },
  { id: 'eastwest', name: 'EastWest Healthcare', logo: '/hmo/eastwest.png' },
  { id: 'asianlife', name: 'AsianLife', logo: '/hmo/asianlife.png' },
  { id: 'valucare', name: 'Valucare', logo: '/hmo/valucare.png' },
];

export const paymentMethods = [
  { id: 'gcash', name: 'GCash', icon: 'Smartphone' },
  { id: 'maya', name: 'Maya', icon: 'Smartphone' },
  { id: 'credit-card', name: 'Credit/Debit Card', icon: 'CreditCard' },
  { id: 'bank-transfer', name: 'Bank Transfer', icon: 'Building2' },
  { id: 'cash', name: 'Cash on Clinic', icon: 'Banknote' },
];
