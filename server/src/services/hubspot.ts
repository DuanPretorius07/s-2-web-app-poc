const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const HUBSPOT_TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

interface HubSpotContact {
  id: string;
  properties?: {
    email?: string;
    firstname?: string;
    lastname?: string;
  };
}

export interface ContactData {
  email: string;
  firstname: string;
  lastname: string;
  company?: string;
}

function hasToken() {
  if (!HUBSPOT_TOKEN) {
    console.log('[HubSpot] Token not configured, skipping');
    return false;
  }
  return true;
}

/**
 * Check if a contact exists in HubSpot by email
 */
async function findContactByEmail(email: string): Promise<HubSpotContact | null> {
  if (!hasToken()) return null;

  try {
    const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'EQ',
                value: email,
              },
            ],
          },
        ],
        properties: ['email', 'firstname', 'lastname'],
        limit: 1,
      }),
    });

    if (!response.ok) {
      console.error('[HubSpot] Search failed:', response.status, await response.text());
      return null;
    }

    const data: any = await response.json();
    if (data?.results?.length) {
      console.log(`[HubSpot] Found existing contact: ${email}`);
      return data.results[0];
    }

    console.log(`[HubSpot] No existing contact found: ${email}`);
    return null;
  } catch (error) {
    console.error('[HubSpot] Error searching for contact:', error);
    return null;
  }
}

/**
 * Create a new contact in HubSpot
 */
async function createContact(contactData: ContactData): Promise<boolean> {
  if (!hasToken()) return false;

  try {
    const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          email: contactData.email,
          firstname: contactData.firstname,
          lastname: contactData.lastname,
          ...(contactData.company && { company: contactData.company }),
        },
      }),
    });

    if (!response.ok) {
      console.error('[HubSpot] Create failed:', response.status, await response.text());
      return false;
    }

    const result: any = await response.json();
    console.log(`[HubSpot] ✅ Contact created: ${contactData.email} (ID: ${result?.id})`);
    return true;
  } catch (error) {
    console.error('[HubSpot] Error creating contact:', error);
    return false;
  }
}

/**
 * Update an existing contact in HubSpot
 */
async function updateContact(contactId: string, contactData: ContactData): Promise<boolean> {
  if (!hasToken()) return false;

  try {
    const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          firstname: contactData.firstname,
          lastname: contactData.lastname,
          ...(contactData.company && { company: contactData.company }),
        },
      }),
    });

    if (!response.ok) {
      console.error('[HubSpot] Update failed:', response.status, await response.text());
      return false;
    }

    console.log(`[HubSpot] ✅ Contact updated: ${contactData.email} (ID: ${contactId})`);
    return true;
  } catch (error) {
    console.error('[HubSpot] Error updating contact:', error);
    return false;
  }
}

/**
 * Upsert a contact: create if doesn't exist, update if exists.
 * Non-blocking: never throws.
 */
export async function upsertContact(contactData: ContactData): Promise<void> {
  console.log(`[HubSpot] Starting upsert for: ${contactData.email}`);

  try {
    const existing = await findContactByEmail(contactData.email);
    if (existing) {
      await updateContact(existing.id, contactData);
    } else {
      await createContact(contactData);
    }
  } catch (error) {
    console.error('[HubSpot] Upsert failed (non-blocking):', error);
  }
}

/**
 * Create a note on a contact (for rate requests)
 */
export async function createNote(email: string, noteContent: string): Promise<boolean> {
  if (!hasToken()) return false;

  try {
    const contact = await findContactByEmail(email);
    if (!contact) {
      console.error('[HubSpot] Cannot create note: contact not found');
      return false;
    }

    const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/notes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          hs_note_body: noteContent,
          hs_timestamp: Date.now(),
        },
        associations: [
          {
            to: { id: contact.id },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 202, // Note -> Contact
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('[HubSpot] Note creation failed:', response.status, await response.text());
      return false;
    }

    console.log(`[HubSpot] ✅ Note created for: ${email}`);
    return true;
  } catch (error) {
    console.error('[HubSpot] Error creating note:', error);
    return false;
  }
}

