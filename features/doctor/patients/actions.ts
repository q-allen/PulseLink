export async function getPatientHistory(patientId: string, doctorId: string) {
  return {
    patientId,
    doctorId,
    fetchedAt: new Date().toISOString(),
  };
}

export async function addPatientNote(patientId: string, doctorId: string, note: string) {
  return {
    id: `note-${Date.now()}`,
    patientId,
    doctorId,
    note,
    createdAt: new Date().toISOString(),
  };
}
