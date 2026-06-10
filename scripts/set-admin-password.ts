import { createClient, type User } from "@supabase/supabase-js";

const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

function requireValue(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

async function findAuthUserByEmail(targetEmail: string): Promise<User | null> {
  const supabase = createClient(
    requireValue(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    requireValue(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Could not list Supabase Auth users: ${error.message}`);
    }

    const users = data.users ?? [];
    const match = users.find((user) => user.email?.trim().toLowerCase() === targetEmail);

    if (match) {
      return match;
    }

    if (users.length < perPage) {
      return null;
    }
  }
}

async function main() {
  const targetEmail = requireValue(email, "ADMIN_BOOTSTRAP_EMAIL");
  const targetPassword = requireValue(password, "ADMIN_BOOTSTRAP_PASSWORD");

  if (targetPassword.length < 8) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 8 characters.");
  }

  const supabase = createClient(
    requireValue(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    requireValue(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const user = await findAuthUserByEmail(targetEmail);
  if (!user) {
    throw new Error(`No Supabase Auth user found for ${targetEmail}.`);
  }

  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    password: targetPassword,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Could not update password for ${targetEmail}: ${error.message}`);
  }

  console.info("Admin password updated successfully.", {
    email: data.user.email,
    userId: data.user.id,
    emailConfirmed: Boolean(data.user.email_confirmed_at),
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Admin password bootstrap failed.");
  process.exitCode = 1;
});
