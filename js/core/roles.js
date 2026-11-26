// Role definitions and capability checks. UI visibility and data mutations
// both go through these rules.

export const ROLES = {
  Student: {
    label: "Student",
    description: "Follow topics and keywords, discover relevant papers and organise your reading list.",
    capabilities: ["savePapers", "followTopics"],
  },
  Faculty: {
    label: "Faculty",
    description: "Create and manage shared reading lists for your students.",
    capabilities: ["savePapers", "createSharedLists", "manageSharedLists"],
  },
  "Club Editor": {
    label: "Club Editor",
    description: "Select papers and publish the weekly science-writing club digest.",
    capabilities: ["savePapers", "publishDigest"],
  },
};

export const ROLE_NAMES = Object.keys(ROLES);

export function normaliseRole(role) {
  return ROLES[role] ? role : "Student";
}

export function can(role, capability) {
  return (ROLES[normaliseRole(role)].capabilities || []).includes(capability);
}
