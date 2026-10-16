/** The user chose not to sign after seeing the preview. Nothing was sent. */
export class TransactionDeclinedError extends Error {
  constructor() {
    super('The user declined the transaction')
  }
}
