const HUBSPOT_API_BASE = 'https://api.hubapi.com';
// Support both token env vars for flexibility
const HUBSPOT_TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN || process.env.HUBSPOT_ACCESS_TOKEN;

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
    console.log('[HubSpot] Token not configured, skipping', {
      hasPrivateToken: !!process.env.HUBSPOT_PRIVATE_APP_TOKEN,
      hasAccessToken: !!process.env.HUBSPOT_ACCESS_TOKEN,
      nodeEnv: process.env.NODE_ENV,
      vercel: process.env.VERCEL,
    });
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
      const errorText = await response.text();
      console.error('[HubSpot] Search failed:', response.status, errorText);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'hubspot.ts:findContactByEmail:searchFailed',message:'HubSpot search API failed',data:{email,status:response.status,errorText:errorText.substring(0,500)},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
      return null;
    }

    const data: any = await response.json();
    if (data?.results?.length) {
      console.log(`[HubSpot] Found existing contact: ${email}`);
      return data.results[0];
    }

    console.log(`[HubSpot] No existing contact found: ${email}`);
    return null;
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'hubspot.ts:findContactByEmail:exception',message:'Exception in findContactByEmail',data:{email,errorMessage:error?.message,errorName:error?.name},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
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
      const errorText = await response.text();
      console.error('[HubSpot] Create failed:', response.status, errorText);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'hubspot.ts:createContact:createFailed',message:'HubSpot create API failed',data:{email:contactData.email,status:response.status,errorText:errorText.substring(0,500)},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
      return false;
    }

    const result: any = await response.json();
    console.log(`[HubSpot] ✅ Contact created: ${contactData.email} (ID: ${result?.id})`);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'hubspot.ts:createContact:success',message:'Contact created successfully',data:{email:contactData.email,contactId:result?.id},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    return true;
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'hubspot.ts:createContact:exception',message:'Exception in createContact',data:{email:contactData.email,errorMessage:error?.message,errorName:error?.name},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
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
  console.log(`[HubSpot] Starting upsert for: ${contactData.email}`, {
    hasToken: !!HUBSPOT_TOKEN,
    tokenLength: HUBSPOT_TOKEN ? HUBSPOT_TOKEN.length : 0,
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
  });

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'hubspot.ts:upsertContact:entry',message:'upsertContact called',data:{email:contactData.email,hasToken:!!HUBSPOT_TOKEN,hasPrivateToken:!!process.env.HUBSPOT_PRIVATE_APP_TOKEN,hasAccessToken:!!process.env.HUBSPOT_ACCESS_TOKEN,nodeEnv:process.env.NODE_ENV,vercel:process.env.VERCEL},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion

  if (!hasToken()) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'hubspot.ts:upsertContact:noToken',message:'No HubSpot token available',data:{hasPrivateToken:!!process.env.HUBSPOT_PRIVATE_APP_TOKEN,hasAccessToken:!!process.env.HUBSPOT_ACCESS_TOKEN},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    return;
  }

  try {
    const existing = await findContactByEmail(contactData.email);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'hubspot.ts:upsertContact:afterSearch',message:'Contact search completed',data:{email:contactData.email,foundExisting:!!existing,contactId:existing?.id},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    
    if (existing) {
      const updateResult = await updateContact(existing.id, contactData);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'hubspot.ts:upsertContact:afterUpdate',message:'Contact update completed',data:{email:contactData.email,contactId:existing.id,success:updateResult},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
    } else {
      const createResult = await createContact(contactData);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'hubspot.ts:upsertContact:afterCreate',message:'Contact create completed',data:{email:contactData.email,success:createResult},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
    }
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fbdc8caf-9cc6-403b-83c1-f186ed9b4695',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'hubspot.ts:upsertContact:error',message:'Upsert error caught',data:{email:contactData.email,errorMessage:error?.message,errorName:error?.name,errorStack:error?.stack?.substring(0,500)},timestamp:Date.now(),runId:'hubspot-debug',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    console.error('[HubSpot] Upsert failed (non-blocking):', error);
    // Log full error details for debugging
    if (error?.response) {
      console.error('[HubSpot] Response status:', error.response.status);
      console.error('[HubSpot] Response body:', await error.response.text().catch(() => 'Unable to read response'));
    }
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

