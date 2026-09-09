import api from './index';

export const fetchMeetingHistory = async () => {
  const response = await api.get('/get_all_activity');
  return response.data; // Expected array of meetings
};

export const createMeeting = async (meetingData) => {
  const response = await api.post('/create_meeting', meetingData);
  return response.data;
};

export const addMeetingToHistory = async (meetingCode) => {
  const response = await api.post('/add_to_activity', {
    meeting_code: meetingCode,
  });
  return response.data;
};

export const deleteMeetingFromHistory = async (idOrCode) => {
  const response = await api.post('/delete_history', {
    meetingId: idOrCode,
    meetingCode: idOrCode,
  });
  return response.data;
};

export const getMeetingDetails = async (meetingCode) => {
  const response = await api.get(`/meeting/${encodeURIComponent(meetingCode)}`);
  return response.data;
};

export const sendAiPrompt = async (prompt, history = []) => {
  const response = await api.post('/ai_assistant', { prompt, history });
  return response.data;
};


