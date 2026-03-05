import { auth } from "../../../auth";
import { purgeInactiveInsuranceCards } from "../../actions/storage-actions";
import { bytesToMegabytes, getPrivateUploadsUsageBytes } from "../../../lib/local-storage";
import { redirect } from "next/navigation";

function formatMegabytes(value: number) {
  return value.toFixed(2);
}

export default async function AdminStoragePage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const usedBytes = await getPrivateUploadsUsageBytes();
  const usedMegabytes = bytesToMegabytes(usedBytes);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Secure Local Storage</h1>
        <p className="text-sm text-gray-600">
          Monitor and purge Insurance Card files that are stored in private server storage.
        </p>
      </header>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <p className="text-sm uppercase tracking-wide text-blue-800">Current Usage</p>
        <p className="mt-2 text-4xl font-bold text-blue-950">{formatMegabytes(usedMegabytes)} MB</p>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900">Purge Archived or Graduated Records</h2>
        <p className="mt-2 text-sm text-red-800">
          This permanently deletes locally stored Insurance Card files for roster members marked
          ARCHIVED or GRADUATED, then clears each file reference in the database.
        </p>

        <form action={purgeInactiveInsuranceCards} className="mt-4">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-red-700 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-red-800"
          >
            Purge Inactive Records
          </button>
        </form>
      </div>
    </section>
  );
}
