import { describe, expect, it } from 'vitest'
import { addSkills, AV_ROLES, departmentOfRoles, firstPick, quotedCrewRole, rolesInUse, skillsInUse, suggestSkills } from '../src/skills.ts'

describe('skills in use', () => {
  it('counts each once per person whatever its case, most used first, in the spelling most have', () => {
    const people = [{ skills: ['Audio', 'Rigger'] }, { skills: ['audio', 'AUDIO'] }, { skills: ['Audio', 'LX', ' '] }, { skills: ['Rigger'] }]
    expect(skillsInUse(people)).toEqual(['Audio', 'Rigger', 'LX'])
  })
})

describe('suggesting skills', () => {
  const known = ['Audio', 'Rigger', 'Monitor engineer', 'Stage manager', 'Audio No.2', 'LX']
  it('offers the most used when nothing is typed, leaving out those chosen', () => {
    expect(suggestSkills(known, '', ['rigger'], 3)).toEqual(['Audio', 'Monitor engineer', 'Stage manager'])
  })
  it('puts those starting with it before those with a word starting with it', () => {
    expect(suggestSkills(known, 'man', [])).toEqual(['Stage manager'])
    expect(suggestSkills(known, 'au', ['Audio'])).toEqual(['Audio No.2'])
    expect(suggestSkills(known, 'eng', [])).toEqual(['Monitor engineer'])
  })
})

describe('the offer Enter takes', () => {
  it('is the one spelt as typed, else the first starting with it', () => {
    expect(firstPick(['Audio No.2', 'Audio'], 'audio', [], false)).toBe(1)
    expect(firstPick(['Audio', 'Audio No.2'], 'au', [], true)).toBe(0)
  })
  it('is the new one when none starts with what is typed', () => {
    expect(firstPick(['Monitor engineer'], 'eng', [], true)).toBe(1)
    expect(firstPick([], 'Pyro', [], true)).toBe(0)
  })
  it('is none with nothing typed, or with what is typed already chosen', () => {
    expect(firstPick(['Audio'], '  ', [], false)).toBe(-1)
    expect(firstPick(['Audio No.2'], 'AUDIO', ['Audio'], false)).toBe(-1)
  })
})

describe('adding skills', () => {
  it('splits a pasted list, keeps each once and uses the list’s own spelling', () => {
    expect(addSkills(['Audio'], 'audio, rigger; Forklift', ['Rigger'])).toEqual(['Audio', 'Rigger', 'Forklift'])
  })
  it('stops at thirty', () => {
    const many = Array.from({ length: 30 }, (_, i) => `S${i}`)
    expect(addSkills(many, 'one more')).toHaveLength(30)
  })
})

describe('roles in use', () => {
  it('counts each role once whatever its case or spacing, most asked for first, in the spelling used most', () => {
    const roles = rolesInUse({
      calls: [{ role: 'LX op' }, { role: 'lx  op' }, { role: 'LX op' }, { role: 'Rigger' }],
      people: [
        { skills: ['Audio', 'rigger', 'Rigger'] },
        { skills: ['Audio', 'LX Op'] },
        { skills: ['Pyro'], archived: true },
      ],
      priced: ['Stage manager', 'RIGGER'],
    })
    expect(roles).toEqual([
      { name: 'LX op', calls: 3, people: 1, priced: false },
      { name: 'Rigger', calls: 1, people: 1, priced: true },
      { name: 'Audio', calls: 0, people: 2, priced: false },
      { name: 'Stage manager', calls: 0, people: 0, priced: true },
    ])
  })
  it('takes the spelling with a capital when two are used alike', () => {
    expect(rolesInUse({ people: [{ skills: ['lampie'] }, { skills: ['Lampie'] }] }).map((r) => r.name)).toEqual(['Lampie'])
  })
  it('leaves out blanks', () => {
    expect(rolesInUse({ calls: [{ role: '  ' }], people: [{ skills: [''] }] })).toEqual([])
  })
})

describe('the usual AV roles and the crew quoted in Current RMS (Colly, 23 November 2026)', () => {
  it('offers the usual roles after those in use, in the spelling the office uses', () => {
    const roles = rolesInUse({ calls: [{ role: 'Sound No.1' }], priced: ['monitor engineer'], standard: AV_ROLES })
    expect(roles[0]?.name).toBe('Sound No.1')
    expect(roles[1]).toMatchObject({ name: 'monitor engineer', priced: true, standard: true })
    expect(roles.slice(2).every((r) => r.standard)).toBe(true)
    expect(roles.filter((r) => r.name.toLowerCase() === 'monitor engineer')).toHaveLength(1)
  })
  it('says the department of each usual role but the general ones', () => {
    const general = AV_ROLES.filter((r) => !departmentOfRoles([r]))
    expect(general).toEqual(['Stagehand', 'Electrician', 'Power tech', 'Warehouse crew'])
  })
  it('reads a quoted service line as a role, leaving out what charges for something else', () => {
    expect(quotedCrewRole('Sound Engineer - per day')).toBe('Sound Engineer')
    expect(quotedCrewRole('LX Tech (day rate)')).toBe('LX Tech')
    expect(quotedCrewRole('Crew Chief')).toBe('Crew Chief')
    expect(quotedCrewRole('Stagehand')).toBe('Stagehand')
    for (const not of ['Delivery & Collection', 'Travel', 'Van hire', 'Mileage per km', 'Accommodation', 'Consumables', 'Insurance']) expect(quotedCrewRole(not)).toBeNull()
  })
  it('reads the department named most by the roles someone does', () => {
    expect(departmentOfRoles(['Monitor engineer', 'RF tech', 'Rigger'])).toBe('Audio')
    expect(departmentOfRoles(['Runner'])).toBe('Production')
    expect(departmentOfRoles(['Electrician'])).toBeNull()
  })
})
