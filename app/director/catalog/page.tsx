import { redirect } from "next/navigation";
import { type Prisma } from "@prisma/client";

import { auth } from "../../../auth";
import { prisma } from "../../../lib/prisma";
import { CatalogSearchClient } from "./_components/catalog-search-client";

function parseRequirementConfig(config: Prisma.JsonValue) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {
      minAge: null,
      maxAge: null,
      requiredMemberRole: null,
      requiredHonorCode: null,
      requiredMasterGuide: null,
    };
  }
  const raw = config as Record<string, unknown>;
  return {
    minAge: typeof raw.minAge === "number" ? raw.minAge : null,
    maxAge: typeof raw.maxAge === "number" ? raw.maxAge : null,
    requiredMemberRole:
      typeof raw.requiredMemberRole === "string" ? raw.requiredMemberRole : null,
    requiredHonorCode:
      typeof raw.requiredHonorCode === "string" ? raw.requiredHonorCode : null,
    requiredMasterGuide:
      typeof raw.requiredMasterGuide === "boolean"
        ? raw.requiredMasterGuide
        : null,
  };
}

export default async function DirectorCatalogPage() {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "CLUB_DIRECTOR" && session.user.role !== "SUPER_ADMIN")
  ) {
    redirect("/login");
  }

  const now = new Date();

  const catalogItems = await prisma.classCatalog.findMany({
    where: { active: true },
    select: {
      id: true,
      title: true,
      code: true,
      description: true,
      classType: true,
      requirements: {
        select: { requirementType: true, config: true },
      },
      offerings: {
        where: {
          active: true,
          event: {
            endsAt: { gte: now },
            isPublished: true,
          },
        },
        select: {
          event: { select: { name: true } },
        },
      },
    },
    orderBy: [{ classType: "asc" }, { title: "asc" }],
  });

  const items = catalogItems.map((item) => ({
    id: item.id,
    title: item.title,
    code: item.code,
    description: item.description,
    classType: item.classType as string,
    requirements: item.requirements.map((r) => ({
      requirementType: r.requirementType as string,
      ...parseRequirementConfig(r.config),
    })),
    upcomingEvents: [
      ...new Set(item.offerings.map((o) => o.event.name)),
    ],
  }));

  return (
    <section className="space-y-6">
      <header className="glass-panel">
        <p className="hero-kicker">Director Resources</p>
        <h1 className="hero-title mt-3">Class Catalog</h1>
        <p className="hero-copy">
          Browse all available honors, specialties, and workshops. Use this
          catalog to plan class preferences before registration opens.
        </p>
      </header>

      <div className="glass-panel">
        <CatalogSearchClient items={items} />
      </div>
    </section>
  );
}
