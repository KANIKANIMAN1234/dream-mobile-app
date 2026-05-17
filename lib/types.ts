export type LiffSessionResponse =
  | {
      ok: true;
      linked: true;
      customer: {
        id: string;
        customer_code: string;
        name: string;
        phone: string;
        postal_code: string | null;
        address: string | null;
      };
      profile: {
        emergency_contact_name: string | null;
        emergency_contact_phone: string | null;
        household_size: number | null;
        family_composition: string | null;
        profile_confirmed_at: string | null;
      } | null;
    }
  | {
      ok: true;
      linked: false;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export type DashboardResponse =
  | {
      ok: true;
      orders: Array<{ month: string; total_amount: number; status: string }>;
      deliveries: Array<{ delivery_date: string; status: string }>;
      notices: Array<{ title: string; body: string; created_at: string }>;
    }
  | {
      ok: false;
      message: string;
    };
