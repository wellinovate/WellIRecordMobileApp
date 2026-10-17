import { IMMUNIZATION_SCHEDULE } from '../../server/data/immunizationSchedule';
import * as M from '../../server/data/milestones';
import { writeFileSync } from 'fs';
writeFileSync('./data.json', JSON.stringify({ imm: IMMUNIZATION_SCHEDULE, ms: (M as any).MILESTONE_CATALOGUE }, null, 1));
