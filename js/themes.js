const THEMES = [
    { id: '1', label: 'Nightmare W' },
    { id: '2', label: 'Nightmare B' },
    { id: '3', label: 'Dreamcore 1' },
    { id: '4', label: 'Dreamcore 2' },
    { id: '5', label: 'Windows XP' },
    { id: '6', label: 'Makima' },
    { id: '7', label: 'Rebecca' },
    { id: '8', label: 'Psychopomp' },
    { id: '9', label: 'Arcane' },
    { id: '10', label: 'Glitchcore' },
    { id: '11', label: 'L' },
    { id: '12', label: 'Evangelion' },
    { id: '13', label: 'Acid Bath' },
    { id: '14', label: 'Soft Void' },
    { id: '15', label: 'Soft Ember' },
    { id: '16', label: 'Soft Fog' },
    { id: '17', label: 'Soft Dusk' },
    { id: '18', label: 'Soft Moss' },
    { id: '19', label: 'Soft Ash' },
    { id: '20', label: 'Halloween' },
    { id: '21', label: 'New Year' },
    { id: '22', label: 'Thanksgiving' },
    { id: '23', label: 'Longest Night' },
    { id: '24', label: 'NitW' },
    { id: '25', label: 'Lovely' },
    { id: '26', label: 'Scooby-Doo' },
    { id: '27', label: 'Ben 10' },
    { id: '28', label: 'Courage' },
    { id: '29', label: 'Spring' },
    { id: '30', label: 'Summer' },
    { id: '31', label: 'Autumn' },
    { id: '32', label: 'Winter' }
];

function themeLabel(id) {
    const t = THEMES.find((x) => x.id === String(id));
    return t ? t.label : THEMES[0].label;
}

module.exports = { THEMES, themeLabel };