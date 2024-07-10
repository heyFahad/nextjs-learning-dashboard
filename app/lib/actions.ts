'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

const InvoiceSchema = z.object({
  id: z.string(),
  customerId: z.string({ message: 'Please select a customer' }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than 0' }),
  date: z.string(),
  status: z.enum(['pending', 'paid'], {
    message: 'Please select an invoice status',
  }),
});

const CreateInvoiceSchema = InvoiceSchema.omit({ id: true, date: true });
const UpdateInvoiceSchema = InvoiceSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(
  prevState: State,
  formData: FormData,
): Promise<State> {
  // validate form fields using Zod
  const rawFormData = Object.fromEntries(formData.entries());
  const parsedFormData = CreateInvoiceSchema.safeParse(rawFormData);
  console.log({ parsedFormData: JSON.stringify(parsedFormData) });

  // If form validation fails, return errors early. Otherwise, continue.
  if (!parsedFormData.success) {
    return {
      errors: parsedFormData.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  // Prepare data for insertion into the database
  const { customerId, amount, status } = parsedFormData.data;
  const amountInCents = amount * 100; // amounts are usually stored in cents in the db to avoid the floating point anomalies of the data
  const date = new Date().toISOString().split('T')[0]; // this will return the date in YYYY-MM-DD format

  // finally, store the new invoice data in the database
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }

  // revalidate cache and redirect the user to the invoices listing page
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData,
): Promise<State> {
  // validate the incoming form data using Zod
  const rawFormData = Object.fromEntries(formData.entries());
  const parsedFormData = UpdateInvoiceSchema.safeParse(rawFormData);

  // if validation fails, return early with the errors. Proceed otherwise
  if (!parsedFormData.success) {
    return {
      errors: parsedFormData.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice',
    };
  }

  // Prepare data to be updated in the database
  const { customerId, amount, status } = parsedFormData.data;
  const amountInCents = amount * 100; // again, convert the amount in cents to avoid floating point errors

  // update the invoice data in the database
  try {
    await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `;
  } catch (error) {
    return { message: 'Database Error: Failed to Update Invoice.' };
  }

  // finally, revalidate cache and redirect the user to invoices page
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
    return { message: 'Deleted Invoice.' };
  } catch (error) {
    return { message: 'Database Error: Failed to Delete Invoice.' };
  }
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}
