// Developmental milestone checklist.
//
// Source: CDC "Learn the Signs. Act Early" milestone checklists (2022
// revision, pages updated February 2026), ages 2 months to 5 years. These
// are things most children do by the given age. Wording is shortened and made
// gender neutral. Not a screening tool and not a diagnosis.
//
// REVIEW STATUS: the CDC list is a US programme. `reviewStatus` stays
// 'pending_clinical_review' until a Nigerian paediatrician has checked it for
// local use and set `reviewedBy` and `reviewedOn`. Bump `version` on any change.

export type MilestoneDomain = 'social' | 'language' | 'cognitive' | 'movement';

export interface Milestone {
  code: string;
  ageMonths: number;
  domain: MilestoneDomain;
  text: string;
}

const BANDS: Record<number, Partial<Record<MilestoneDomain, string[]>>> = {
  2: {
    social: ['Calms down when spoken to or picked up', 'Looks at your face', 'Seems happy to see you', 'Smiles when you talk to or smile at them'],
    language: ['Makes sounds other than crying', 'Reacts to loud sounds'],
    cognitive: ['Watches you as you move', 'Looks at a toy for several seconds'],
    movement: ['Holds head up when on tummy', 'Moves both arms and both legs', 'Opens hands briefly'],
  },
  4: {
    social: ['Smiles on their own to get your attention', 'Chuckles when you try to make them laugh', 'Looks at you, moves, or makes sounds to get or keep your attention'],
    language: ['Makes cooing sounds like "oooo" and "aahh"', 'Makes sounds back when you talk to them', 'Turns head towards the sound of your voice'],
    cognitive: ['If hungry, opens mouth when they see the breast or bottle', 'Looks at their hands with interest'],
    movement: ['Holds head steady without support when you hold them', 'Holds a toy when you put it in their hand', 'Uses their arm to swing at toys', 'Brings hands to mouth', 'Pushes up onto elbows or forearms when on tummy'],
  },
  6: {
    social: ['Knows familiar people', 'Likes to look at themselves in a mirror', 'Laughs'],
    language: ['Takes turns making sounds with you', 'Blows "raspberries" (sticks tongue out and blows)', 'Makes squealing noises'],
    cognitive: ['Puts things in their mouth to explore them', 'Reaches to grab a toy they want', 'Closes lips to show they do not want more food'],
    movement: ['Rolls from tummy to back', 'Pushes up with straight arms when on tummy', 'Leans on hands to support themselves when sitting'],
  },
  9: {
    social: ['Is shy, clingy, or fearful around strangers', 'Shows several facial expressions, like happy, sad, angry and surprised', 'Looks when you call their name', 'Reacts when you leave (looks, reaches for you, or cries)', 'Smiles or laughs when you play peek-a-boo'],
    language: ['Makes a lot of different sounds like "mamamama" and "bababababa"', 'Lifts arms up to be picked up'],
    cognitive: ['Looks for objects when dropped out of sight', 'Bangs two things together'],
    movement: ['Gets to a sitting position by themselves', 'Moves things from one hand to the other', 'Uses fingers to "rake" food towards themselves', 'Sits without support'],
  },
  12: {
    social: ['Plays games with you, like pat-a-cake'],
    language: ['Waves "bye-bye"', 'Calls a parent "mama" or "dada" or another special name', 'Understands "no" (pauses briefly or stops when you say it)'],
    cognitive: ['Puts something in a container, like a block in a cup', 'Looks for things they see you hide, like a toy under a blanket'],
    movement: ['Pulls up to stand', 'Walks, holding on to furniture', 'Drinks from a cup without a lid, as you hold it', 'Picks things up between thumb and pointer finger, like small bits of food'],
  },
  15: {
    social: ['Copies other children while playing', 'Shows you an object they like', 'Claps when excited', 'Hugs a stuffed doll or other toy', 'Shows you affection (hugs, cuddles, or kisses)'],
    language: ['Tries to say one or two words besides "mama" or "dada"', 'Looks at a familiar object when you name it', 'Follows directions given with both a gesture and words', 'Points to ask for something or to get help'],
    cognitive: ['Tries to use things the right way, like a phone, cup, or book', 'Stacks at least two small objects, like blocks'],
    movement: ['Takes a few steps on their own', 'Uses fingers to feed themselves some food'],
  },
  18: {
    social: ['Moves away from you, but looks to make sure you are close by', 'Points to show you something interesting', 'Puts hands out for you to wash them', 'Looks at a few pages in a book with you', 'Helps you dress them by pushing an arm through a sleeve or lifting a foot'],
    language: ['Tries to say three or more words besides "mama" or "dada"', 'Follows one-step directions without any gestures'],
    cognitive: ['Copies you doing chores, like sweeping with a broom', 'Plays with toys in a simple way, like pushing a toy car'],
    movement: ['Walks without holding on to anyone or anything', 'Scribbles', 'Drinks from a cup without a lid and may spill sometimes', 'Feeds themselves with their fingers', 'Tries to use a spoon', 'Climbs on and off a couch or chair without help'],
  },
  24: {
    social: ['Notices when others are hurt or upset', 'Looks at your face to see how to react in a new situation'],
    language: ['Points to things in a book when you ask', 'Says at least two words together, like "More milk"', 'Points to at least two body parts when you ask', 'Uses more gestures than just waving and pointing, like blowing a kiss or nodding yes'],
    cognitive: ['Holds something in one hand while using the other hand', 'Tries to use switches, knobs, or buttons on a toy', 'Plays with more than one toy at the same time'],
    movement: ['Kicks a ball', 'Runs', 'Walks up a few stairs with or without help', 'Eats with a spoon'],
  },
  30: {
    social: ['Plays next to other children and sometimes plays with them', 'Shows you what they can do by saying "Look at me!"', 'Follows simple routines when told, like helping to pick up toys'],
    language: ['Says about 50 words', 'Says two or more words together, with one action word, like "Doggie run"', 'Names things in a book when you point and ask', 'Says words like "I", "me", or "we"'],
    cognitive: ['Uses things to pretend, like feeding a block to a doll', 'Shows simple problem-solving skills, like standing on a small stool to reach something', 'Follows two-step instructions', 'Shows they know at least one color'],
    movement: ['Uses hands to twist things, like turning doorknobs or unscrewing lids', 'Takes some clothes off by themselves', 'Jumps off the ground with both feet', 'Turns book pages one at a time'],
  },
  36: {
    social: ['Calms down within 10 minutes after you leave, like at a childcare drop off', 'Notices other children and joins them to play'],
    language: ['Talks with you in conversation using at least two back-and-forth exchanges', 'Asks "who", "what", "where", or "why" questions', 'Says what action is happening in a picture or book when asked', 'Says their first name when asked', 'Talks well enough for others to understand, most of the time'],
    cognitive: ['Draws a circle when you show them how', 'Avoids touching hot objects, like a stove, when you warn them'],
    movement: ['Strings items together, like large beads or macaroni', 'Puts on some clothes by themselves', 'Uses a fork'],
  },
  48: {
    social: ['Pretends to be something else during play', 'Asks to go play with children if none are around', 'Comforts others who are hurt or sad', 'Avoids danger, like not jumping from tall heights at the playground', 'Likes to be a "helper"', 'Changes behavior based on where they are'],
    language: ['Says sentences with four or more words', 'Says some words from a song, story, or nursery rhyme', 'Talks about at least one thing that happened during their day', 'Answers simple questions like "What is a coat for?"'],
    cognitive: ['Names a few colors of items', 'Tells what comes next in a well-known story', 'Draws a person with three or more body parts'],
    movement: ['Catches a large ball most of the time', 'Serves themselves food or pours water, with adult supervision', 'Unbuttons some buttons', 'Holds a crayon or pencil between fingers and thumb (not a fist)'],
  },
  60: {
    social: ['Follows rules or takes turns when playing games with other children', 'Sings, dances, or acts for you', 'Does simple chores at home, like matching socks or clearing the table'],
    language: ['Tells a story they heard or made up with at least two events', 'Answers simple questions about a book or story after you read or tell it', 'Keeps a conversation going with more than three back-and-forth exchanges', 'Uses or recognizes simple rhymes'],
    cognitive: ['Counts to 10', 'Names some numbers between 1 and 5 when you point to them', 'Uses words about time, like "yesterday", "tomorrow", "morning", or "night"', 'Pays attention for 5 to 10 minutes during activities', 'Writes some letters in their name', 'Names some letters when you point to them'],
    movement: ['Buttons some buttons', 'Hops on one foot'],
  },
};

const DOMAIN_CODE: Record<MilestoneDomain, string> = { social: 'S', language: 'L', cognitive: 'C', movement: 'M' };

const milestones: Milestone[] = [];
for (const [age, domains] of Object.entries(BANDS)) {
  for (const [domain, items] of Object.entries(domains) as [MilestoneDomain, string[]][]) {
    items.forEach((text, i) => {
      milestones.push({ code: `${age}m-${DOMAIN_CODE[domain]}${i + 1}`, ageMonths: Number(age), domain, text });
    });
  }
}

export const MILESTONE_CATALOGUE = {
  version: '2026-10-draft-1',
  reviewStatus: 'pending_clinical_review' as 'pending_clinical_review' | 'reviewed',
  reviewedBy: null as string | null,
  reviewedOn: null as string | null,
  source: 'CDC Learn the Signs. Act Early milestone checklists (2022 revision, updated February 2026)',
  domains: {
    social: 'Social and emotional',
    language: 'Language and communication',
    cognitive: 'Learning and thinking',
    movement: 'Movement and physical',
  } as Record<MilestoneDomain, string>,
  milestones,
};

export const MILESTONE_CODES = new Set(milestones.map((m) => m.code));
