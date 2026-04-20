import { Review, ApiResponse } from '@/types';
import { api, API_ENDPOINTS } from './api';
import { mapReview } from './mappers';

export const reviewService = {
  async getDoctorReviews(doctorId: string): Promise<ApiResponse<Review[]>> {
    const res = await api.get<Review[] | { results: Review[] }>(
      `${API_ENDPOINTS.APPOINTMENT_REVIEWS}?doctor_id=${doctorId}`
    );
    const list = Array.isArray(res) ? res : res.results ?? [];
    const reviews = list.map(mapReview).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { data: reviews, success: true };
  },

  async getDoctorReviewsByProfileId(profileId: string): Promise<ApiResponse<Review[]>> {
    // First try with the profile id directly (some endpoints accept it),
    // then fall back to fetching the doctor detail to resolve the user id.
    try {
      const res = await this.getDoctorReviews(profileId);
      if (res.data.length > 0) return res;
      // Resolve user_id from doctor detail and retry
      const { api: apiClient, API_ENDPOINTS: EP } = await import('./api');
      const detail = await apiClient.get<any>(EP.DOCTOR_DETAIL(profileId));
      const userId = detail?.user_id ?? detail?.userId;
      if (userId && String(userId) !== String(profileId)) {
        return this.getDoctorReviews(String(userId));
      }
      return res;
    } catch {
      return { data: [], success: false };
    }
  },

  async createReview(data: {
    doctorId: string;
    patientId: string;
    appointmentId: string;
    rating: number;
    comment: string;
  }): Promise<ApiResponse<Review>> {
    const result = await api.post<any>(API_ENDPOINTS.APPOINTMENT_REVIEWS, {
      appointment_id: data.appointmentId,
      rating: data.rating,
      comment: data.comment,
    });
    return { data: mapReview(result), success: true, message: "Review submitted" };
  },

  async getAverageRating(doctorId: string): Promise<ApiResponse<{ average: number; count: number }>> {
    const reviewsRes = await this.getDoctorReviews(doctorId);
    if (!reviewsRes.success) return { data: { average: 0, count: 0 }, success: false };
    const doctorReviews = reviewsRes.data;
    const average = doctorReviews.length > 0
      ? doctorReviews.reduce((sum, r) => sum + r.rating, 0) / doctorReviews.length
      : 0;
    return {
      data: { average: Math.round(average * 10) / 10, count: doctorReviews.length },
      success: true,
    };
  },
};
