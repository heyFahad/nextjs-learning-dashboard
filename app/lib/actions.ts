'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const InvoiceSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  date: z.string(),
  status: z.enum(['pending', 'paid']),
});

const CreateInvoiceSchema = InvoiceSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
  const rawFormData = Object.fromEntries(formData.entries());
  const { customerId, amount, status } = CreateInvoiceSchema.parse(rawFormData);

  const amountInCents = amount * 100; // amounts are usually stored in cents in the db to avoid the floating point anomalies of the data
  const date = new Date().toISOString().split('T')[0]; // this will return the date in YYYY-MM-DD format

  // finally, store the new invoice data in the database
  await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;

  // revalidate cache and redirect the user to the invoices listing page
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}
