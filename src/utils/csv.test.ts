import { describe, expect, it } from 'vitest'
import { csvToRecords, parseCsv, recordTemplateCsv, recordsToCsv, toCsv } from './csv'
import { emptyEmployment, emptyRecord } from './records'

describe('parseCsv / toCsv', () => {
  it('round-trips quotes, commas and newlines', () => {
    const rows = [
      ['Name', 'Note'],
      ['Ishita, B.', 'Said "hello"\non two lines'],
    ]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })

  it('strips a BOM, handles CRLF and drops blank lines', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('neutralises spreadsheet formulas but keeps phone numbers', () => {
    expect(toCsv([['=HYPERLINK("x")', '+91 90000 00000', '-5', '@SUM(A1)']])).toBe(
      `"'=HYPERLINK(""x"")",+91 90000 00000,-5,'@SUM(A1)`,
    )
  })
})

describe('csvToRecords', () => {
  it('reads the template row into a full record', () => {
    const { records, errors } = csvToRecords(recordTemplateCsv(), new Date('2026-10-12').getTime())
    expect(errors).toEqual([])
    expect(records).toHaveLength(1)
    const [r] = records
    expect(r).toMatchObject({
      name: 'Sample Student',
      programme: 'B.A. (Hons) Economics',
      graduationYear: '2025',
      status: 'alumni',
      hadInternships: 'yes',
      source: 'import',
      ownerUid: null,
    })
    expect(r.internships).toHaveLength(1)
    expect(r.higherStudies[0]).toMatchObject({ course: 'M.A. Economics', institution: 'Sample University' })
    expect(r.exams.map((e) => [e.exam, e.result, e.year])).toEqual([
      ['CUET-PG', 'qualified', '2025'],
      ['NET', 'appeared', '2025'],
    ])
  })

  it('matches headers loosely, skips nameless rows and keeps unknown exams', () => {
    const csv = 'student name,COURSE NAME,graduation year,exams qualified\n,B.Com,2024,\nAisha Khan,,2020,GRE 2021 (320); NET 2022\n'
    const { records, errors } = csvToRecords(csv, new Date('2026-10-12').getTime())
    expect(records).toHaveLength(1)
    expect(records[0].status).toBe('alumni')
    expect(records[0].exams.map((e) => [e.exam, e.otherName, e.year, e.score])).toEqual([
      ['OTHERS', 'GRE', '2021', '320'],
      ['NET', '', '2022', ''],
    ])
    expect(errors).toHaveLength(2)
  })

  it('rejects files without a name column', () => {
    expect(csvToRecords('a,b\n1,2').errors[0]).toMatch(/Student Name/)
  })
})

describe('recordsToCsv', () => {
  it('exports form columns that re-import cleanly', () => {
    const record = emptyRecord({
      name: 'Kavya Menon',
      programme: 'B.Com (Hons)',
      admissionYear: '2021',
      graduationYear: '2024',
      status: 'alumni',
      employment: [{ ...emptyEmployment(), designation: 'Audit Associate', company: 'Fabrikam & Co. LLP', annualPackageLPA: '5.2' }],
    })
    const csv = recordsToCsv([record])
    expect(csv.split('\r\n')[0]).toMatch(/^Student Name,Examination Roll No\.,Course Name/)
    const [back] = csvToRecords(csv).records
    expect(back.employment[0]).toMatchObject({ designation: 'Audit Associate', company: 'Fabrikam & Co. LLP', annualPackageLPA: '5.2' })
    expect(back.status).toBe('alumni')
  })
})
