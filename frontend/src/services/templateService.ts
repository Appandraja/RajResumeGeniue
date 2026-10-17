import api from './api';
import type { Template } from '../types';

export async function listTemplates(): Promise<Template[]> {
  const { data } = await api.get<Template[]>('/api/templates');
  return data;
}

export async function getTemplate(id: number): Promise<Template> {
  const { data } = await api.get<Template>(`/api/templates/${id}`);
  return data;
}
