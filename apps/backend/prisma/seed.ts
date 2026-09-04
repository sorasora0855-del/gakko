import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * 初期seedデータ。
 * 計画書セクション2: 初期バージョンでは「1年1組」のみを対象として運用する。
 * ただし将来の拡張に備え、他学年・他クラスもレコードとしては作成し、isActive=falseで無効化しておく。
 */
async function main() {
  const currentYear = await prisma.academicYear.upsert({
    where: { year: 2026 },
    update: { isCurrent: true },
    create: { year: 2026, isCurrent: true },
  });

  const gradeNames = ["1年", "2年", "3年"];
  const grades = [];
  for (const name of gradeNames) {
    const grade = await prisma.grade.upsert({
      where: { id: `seed-grade-${name}` },
      update: { isActive: name === "1年" },
      create: { id: `seed-grade-${name}`, name, isActive: name === "1年" },
    });
    grades.push(grade);
  }

  const classPlan: Record<string, string[]> = {
    "1年": ["1組", "2組", "3組"],
    "2年": ["1組", "2組", "3組"],
    "3年": ["1組", "2組", "3組"],
  };

  for (const grade of grades) {
    const classNames = classPlan[grade.name] ?? [];
    for (const className of classNames) {
      const isActive = grade.name === "1年" && className === "1組";
      await prisma.class.upsert({
        where: { id: `seed-class-${grade.name}-${className}` },
        update: { isActive },
        create: {
          id: `seed-class-${grade.name}-${className}`,
          gradeId: grade.id,
          name: className,
          isActive,
        },
      });
    }
  }

  console.log(`Seed complete. Current academic year: ${currentYear.year}`);
  console.log("Active scope: 1年1組 only (per plan v1.0 section 2).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
