export function ensureProPadel(state) {
  if (state.clubs.some(club => club.id === 'pro-padel')) return;

  state.clubs.push({
    id: 'pro-padel',
    name: 'Pro Padel Academy',
    city: '',
    initials: 'PPA',
    primary: '#7897aa',
    accent: '#ffff00',
    canvas: '#f4f6f7',
    logo: './pro-padel-logo.png',
    loginLogo: '',
    courts: Array.from({ length: 7 }, (_, index) => ({
      id: 'pro-padel-' + (index + 1),
      name: 'Campo ' + (index + 1),
      type: 'Indoor',
      price: 52,
    })),
  });
}
