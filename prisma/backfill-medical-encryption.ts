import { encryptMedicalText } from "../lib/encryption";
import { prisma } from "../lib/prisma";
import {
  encryptMedicalDate,
  isEncryptedMedicalValue,
  validateMedicalEncryptionConfiguration,
} from "../lib/medical-data";

function normalizeNullableText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function main() {
  validateMedicalEncryptionConfiguration();

  const members = await prisma.rosterMember.findMany({
    select: {
      id: true,
      medicalFlags: true,
      dietaryRestrictions: true,
      insuranceCompany: true,
      insurancePolicyNumber: true,
      lastTetanusDate: true,
      lastTetanusDateEncrypted: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  let updatedCount = 0;

  for (const member of members) {
    const nextMedicalFlags = isEncryptedMedicalValue(member.medicalFlags)
      ? member.medicalFlags
      : encryptMedicalText(normalizeNullableText(member.medicalFlags));
    const nextDietaryRestrictions = isEncryptedMedicalValue(member.dietaryRestrictions)
      ? member.dietaryRestrictions
      : encryptMedicalText(normalizeNullableText(member.dietaryRestrictions));
    const nextInsuranceCompany = isEncryptedMedicalValue(member.insuranceCompany)
      ? member.insuranceCompany
      : encryptMedicalText(normalizeNullableText(member.insuranceCompany));
    const nextInsurancePolicyNumber = isEncryptedMedicalValue(member.insurancePolicyNumber)
      ? member.insurancePolicyNumber
      : encryptMedicalText(normalizeNullableText(member.insurancePolicyNumber));
    const nextLastTetanusDateEncrypted =
      member.lastTetanusDateEncrypted ?? encryptMedicalDate(member.lastTetanusDate);

    const shouldUpdate =
      nextMedicalFlags !== member.medicalFlags ||
      nextDietaryRestrictions !== member.dietaryRestrictions ||
      nextInsuranceCompany !== member.insuranceCompany ||
      nextInsurancePolicyNumber !== member.insurancePolicyNumber ||
      nextLastTetanusDateEncrypted !== member.lastTetanusDateEncrypted ||
      member.lastTetanusDate !== null;

    if (!shouldUpdate) {
      continue;
    }

    await prisma.rosterMember.update({
      where: {
        id: member.id,
      },
      data: {
        medicalFlags: nextMedicalFlags,
        dietaryRestrictions: nextDietaryRestrictions,
        insuranceCompany: nextInsuranceCompany,
        insurancePolicyNumber: nextInsurancePolicyNumber,
        lastTetanusDateEncrypted: nextLastTetanusDateEncrypted,
        lastTetanusDate: null,
      },
    });

    updatedCount += 1;
  }

  console.log(`Encrypted medical data for ${updatedCount} roster member(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
