import { DEPARTMENT_LABELS, findProducts, type Model } from '@sh/shared'
import { RecordPicker, type PickerAction, type RecordOffer } from './RecordPicker.tsx'

export type { PickerAction } from './RecordPicker.tsx'

type Product = Pick<Model, 'id' | 'name' | 'department' | 'category' | 'aliases'> & { code?: string }

const findIn = (products: readonly Product[], text: string): RecordOffer<Product>[] => findProducts(products, text).map((f) => ({ record: f.product, via: f.via }))
const metaOf = (f: RecordOffer<Product>) => [f.via && `Also called ${f.via}`, DEPARTMENT_LABELS[f.record.department], f.record.category].filter(Boolean).join(' · ')
const nothing = (text: string) => `Nothing in the stock list has “${text}” in it`

/**
 * Choosing one product from the stock list by typing (ADR 0070): the record
 * picker over the stock list. What's typed can be anywhere in the name, in
 * another name the product goes by, or its category or department
 * (findProducts), and each offer says which other name found it. With
 * nothing typed it offers the ones given first (Kit from the notes' "most
 * like it").
 */
export function ProductPicker({
  products,
  placeholder = 'Type to find a product',
  about,
  ...rest
}: {
  label: string
  products: readonly Product[]
  value: string
  shownAs?: string
  first?: readonly Product[]
  firstLabel?: string
  actions?: readonly PickerAction[]
  onPick: (id: string, count?: number) => void
  /** More to say of a product where it's being picked, after its department: on a quote, its price and how many are free. */
  about?: (id: string) => string
  counted?: boolean
  onAction?: (key: string) => void
  disabled?: boolean
  placeholder?: string
  hint?: string
  className?: string
  autoFocus?: boolean
}) {
  const meta = about ? (f: RecordOffer<Product>) => [metaOf(f), about(f.record.id)].filter(Boolean).join(' · ') : metaOf
  return <RecordPicker {...rest} records={products} placeholder={placeholder} find={findIn} meta={meta} nothingFound={nothing} />
}
