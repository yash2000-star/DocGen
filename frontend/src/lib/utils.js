export function getGreeting(name) {
  const hour = new Date().getHours();
  const time = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const first = name?.split(' ')[0] || name || 'there';
  return `Good ${time}, ${first}`;
}