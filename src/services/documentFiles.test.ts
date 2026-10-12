import { describe, expect, it } from 'vitest'
import { blobTypeFor, isRenderableDocument } from './documentFiles'

describe('document blob types', () => {
  it('lets PDFs and raster images render', () => {
    expect(blobTypeFor('data:application/pdf;base64,JVBERi0=')).toBe('application/pdf')
    expect(blobTypeFor('data:image/jpeg;base64,/9j/')).toBe('image/jpeg')
    expect(isRenderableDocument('data:image/png;base64,iVBOR')).toBe(true)
  })

  it('never lets HTML or SVG render as a page on the app origin', () => {
    expect(blobTypeFor('data:text/html;base64,PHNjcmlwdD4=')).toBe('application/octet-stream')
    expect(blobTypeFor('data:image/svg+xml;utf8,%3Csvg%3E')).toBe('application/octet-stream')
    expect(blobTypeFor('javascript:alert(1)')).toBe('application/octet-stream')
    expect(isRenderableDocument('data:TEXT/HTML,<b>x</b>')).toBe(false)
  })
})
