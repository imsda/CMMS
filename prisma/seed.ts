import {
  ClassType,
  MemberRole,
  PrismaClient,
  RequirementType,
  UserRole,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_SUPER_ADMIN_EMAIL =
  process.env.SEED_SUPER_ADMIN_EMAIL ?? "superadmin@cmms.local";
const DEFAULT_SUPER_ADMIN_PASSWORD =
  process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMeNow123!";
const DEFAULT_SUPER_ADMIN_NAME =
  process.env.SEED_SUPER_ADMIN_NAME ?? "CMMS Super Admin";

const DEFAULT_CLUB_CODE = "CONF-TEST-CLUB";

const DEFAULT_HONORS = [
  {
    code: "HONOR-KNTS-001",
    title: "Knots",
    description: "Learn and demonstrate essential camping and safety knots.",
    requirements: [],
  },
  {
    code: "HONOR-CAMP-001",
    title: "Camping Skills",
    description:
      "Covers campsite setup, fire safety, and basic outdoor preparedness.",
    requirements: [
      {
        requirementType: RequirementType.MIN_AGE,
        minAge: 10,
      },
    ],
  },
  {
    code: "HONOR-FIRSTAID-001",
    title: "First Aid",
    description:
      "Demonstrate foundational first aid knowledge for common injuries.",
    requirements: [
      {
        requirementType: RequirementType.MIN_AGE,
        minAge: 12,
      },
    ],
  },
  {
    code: "HONOR-ORIENT-ADV-001",
    title: "Orienteering Advanced",
    description:
      "Advanced map-and-compass navigation including route planning and terrain analysis.",
    requirements: [
      {
        requirementType: RequirementType.MIN_AGE,
        minAge: 15,
      },
      {
        requirementType: RequirementType.COMPLETED_HONOR,
        requiredHonorCode: "HONOR-KNTS-001",
      },
    ],
  },
  {
    code: "HONOR-LEAD-ADV-001",
    title: "Pathfinder Leadership Advanced",
    description:
      "Develop advanced mentoring and leadership competencies for senior pathfinders.",
    requirements: [
      {
        requirementType: RequirementType.MIN_AGE,
        minAge: 15,
      },
      {
        requirementType: RequirementType.MEMBER_ROLE,
        requiredMemberRole: MemberRole.PATHFINDER,
      },
    ],
  },
] as const;

async function seedSuperAdmin() {
  const passwordHash = await bcrypt.hash(DEFAULT_SUPER_ADMIN_PASSWORD, 12);

  const superAdmin = await prisma.user.upsert({
    where: {
      email: DEFAULT_SUPER_ADMIN_EMAIL,
    },
    update: {
      name: DEFAULT_SUPER_ADMIN_NAME,
      role: UserRole.SUPER_ADMIN,
      passwordHash,
    },
    create: {
      email: DEFAULT_SUPER_ADMIN_EMAIL,
      name: DEFAULT_SUPER_ADMIN_NAME,
      role: UserRole.SUPER_ADMIN,
      passwordHash,
    },
  });

  return superAdmin;
}

function getCurrentRosterYear() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const startsOn = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const endsOn = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  return {
    yearLabel: `${year}`,
    startsOn,
    endsOn,
  };
}

async function seedDefaultClub() {
  const club = await prisma.club.upsert({
    where: {
      code: DEFAULT_CLUB_CODE,
    },
    update: {
      name: "Conference Testing Club",
      type: "PATHFINDER",
      city: "Testing City",
      state: "TS",
    },
    create: {
      name: "Conference Testing Club",
      code: DEFAULT_CLUB_CODE,
      type: "PATHFINDER",
      city: "Testing City",
      state: "TS",
    },
  });

  const rosterYear = getCurrentRosterYear();

  await prisma.clubRosterYear.upsert({
    where: {
      clubId_yearLabel: {
        clubId: club.id,
        yearLabel: rosterYear.yearLabel,
      },
    },
    update: {
      startsOn: rosterYear.startsOn,
      endsOn: rosterYear.endsOn,
      isActive: true,
    },
    create: {
      clubId: club.id,
      yearLabel: rosterYear.yearLabel,
      startsOn: rosterYear.startsOn,
      endsOn: rosterYear.endsOn,
      isActive: true,
    },
  });

  return club;
}

async function seedHonors() {
  for (const honor of DEFAULT_HONORS) {
    await prisma.classCatalog.upsert({
      where: {
        code: honor.code,
      },
      update: {
        title: honor.title,
        description: honor.description,
        classType: ClassType.HONOR,
        active: true,
        requirements: {
          deleteMany: {},
          create: honor.requirements,
        },
      },
      create: {
        code: honor.code,
        title: honor.title,
        description: honor.description,
        classType: ClassType.HONOR,
        active: true,
        requirements: {
          create: honor.requirements,
        },
      },
    });
  }
}

async function main() {
  const superAdmin = await seedSuperAdmin();
  const club = await seedDefaultClub();
  await seedHonors();

  console.log("Seed complete:");
  console.log(`- Super Admin: ${superAdmin.email}`);
  console.log(`- Club: ${club.name} (${club.code})`);
  console.log(`- Honors seeded: ${DEFAULT_HONORS.length}`);
}

main()
  .catch((error) => {
    console.error("Seeding failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
