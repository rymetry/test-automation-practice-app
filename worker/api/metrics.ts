import { COLUMN_IDS, COLUMN_NAMES, type Metrics } from '../types';
import { type ApiHandler, json, methodNotAllowed } from './http';

const AGE_GROUPS: { group: string; min: number; max: number }[] = [
  { group: '<20', min: 0, max: 19 },
  { group: '20-29', min: 20, max: 29 },
  { group: '30-39', min: 30, max: 39 },
  { group: '40-49', min: 40, max: 49 },
  { group: '50+', min: 50, max: Infinity },
];

export const handleMetrics: ApiHandler = async ({ path, method, session }) => {
  if (path !== '/api/metrics') return null;
  if (method !== 'GET') return methodNotAllowed('GET');

  const [contacts, cards] = await Promise.all([session.listContacts(), session.listCards()]);
  const metrics: Metrics = {
    contactsByAgeGroup: AGE_GROUPS.map(({ group, min, max }) => ({
      group,
      count: contacts.filter((c) => c.age >= min && c.age <= max).length,
    })),
    cardsByColumn: COLUMN_IDS.map((column) => ({
      column,
      name: COLUMN_NAMES[column],
      count: cards.filter((card) => card.column === column).length,
    })),
  };
  return json(metrics);
};
