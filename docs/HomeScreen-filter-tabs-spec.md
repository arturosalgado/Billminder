# HomeScreen filter tabs (spec)

**Where:** Horizontal `ScrollView` (no horizontal indicator) under the summary card, above **Bills** + `FlatList`. Don’t use a tight `maxHeight` on the row—chips need ~44pt min height so **20pt** icons aren’t clipped.

**Tabs:** Each chip = **Ionicons (20)** + **count**; use **`accessibilityLabel`** for full wording (e.g. “Overdue bills, 3 bills”).

| Key | Rule | Icon |
|-----|------|------|
| All | Every bill | `layers-outline` |
| Upcoming | Unpaid, `startOfDay(due) >= today` | `today-outline` |
| Overdue | Unpaid, `startOfDay(due) < today` | `alert-circle-outline` |
| Paid | `paid === true` | `checkmark-circle-outline` |

**Look:** Active = **primary** fill/border, white icon + count. Inactive = card + muted icon/count. If `overdueCount > 0`, **Overdue** chip is **danger** (red) until selected; selected Overdue uses **blue** like others.

**Behaviour:** Tab → `filteredBills` updates the list immediately. **`useFocusEffect`:** reset filter to **All** on focus. Empty filtered list: **“No bills matching {All|Upcoming|Overdue|Paid}.”** Use **`startOfDay`** from `utils/billUtils.js`.
