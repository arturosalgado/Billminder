import { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCategories } from '../context/CategoriesContext';
import { useBills } from '../context/BillsContext';
import { colors, fontSize, fontWeight, layout, shadows } from '../theme';
import { BILL_CATEGORIES } from '../utils/billCategories';

export default function CategoriesScreen() {
  const {
    customCategories,
    addCustomCategory,
    updateCustomCategory,
    removeCustomCategory,
  } = useCategories();
  const { bills, reassignBillsCategoryToOther } = useBills();

  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState('');

  const openAdd = useCallback(() => {
    setAddText('');
    setAddOpen(true);
  }, []);

  const confirmAdd = useCallback(() => {
    const r = addCustomCategory(addText);
    if (!r.ok) {
      if (r.error === 'empty') {
        Alert.alert('Name required', 'Please enter a category name.');
      } else if (r.error === 'duplicate') {
        Alert.alert(
          'Duplicate name',
          'A category with this name already exists.'
        );
      }
      return;
    }
    setAddOpen(false);
    setAddText('');
  }, [addCustomCategory, addText]);

  const openEdit = useCallback((cat) => {
    setEditId(cat.id);
    setEditText(cat.label);
    setEditOpen(true);
  }, []);

  const confirmEdit = useCallback(() => {
    if (!editId) return;
    const r = updateCustomCategory(editId, editText);
    if (!r.ok) {
      if (r.error === 'empty') {
        Alert.alert('Name required', 'Please enter a category name.');
      } else if (r.error === 'duplicate') {
        Alert.alert(
          'Duplicate name',
          'A category with this name already exists.'
        );
      } else {
        Alert.alert('Not found', 'This category could not be updated.');
      }
      return;
    }
    setEditOpen(false);
    setEditId(null);
    setEditText('');
  }, [editId, editText, updateCustomCategory]);

  const tryRemove = useCallback(
    (cat) => {
      const count = bills.filter((b) => b.category === cat.id).length;
      const proceed = () => {
        if (count > 0) reassignBillsCategoryToOther(cat.id);
        removeCustomCategory(cat.id);
      };
      if (count > 0) {
        Alert.alert(
          'Remove category?',
          `${count} bill${count === 1 ? '' : 's'} use “${cat.label}”. They will be moved to Other.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: proceed },
          ]
        );
      } else {
        Alert.alert(
          'Remove category?',
          `Remove “${cat.label}”?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: proceed },
          ]
        );
      }
    },
    [bills, reassignBillsCategoryToOther, removeCustomCategory]
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionLabel}>Built-in</Text>
      <Text style={styles.hint}>
        These categories are always available and cannot be removed.
      </Text>
      <View style={styles.card}>
        {BILL_CATEGORIES.map((c, i) => (
          <View
            key={c.id}
            style={[styles.row, i > 0 && styles.rowBorder]}
          >
            <View
              style={[styles.swatch, { backgroundColor: `${c.color}33` }]}
            />
            <Text style={styles.rowLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>Your categories</Text>
        <Pressable
          onPress={openAdd}
          style={({ pressed }) => [
            styles.addBtn,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add category"
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {customCategories.length === 0 ? (
        <Text style={styles.emptyHint}>
          No custom categories yet. Tap Add to create one.
        </Text>
      ) : (
        <View style={styles.card}>
          {customCategories.map((c, i) => (
            <View
              key={c.id}
              style={[styles.row, i > 0 && styles.rowBorder]}
            >
              <View
                style={[styles.swatch, { backgroundColor: `${c.color}33` }]}
              />
              <Text style={styles.rowLabelFlex}>{c.label}</Text>
              <Pressable
                onPress={() => openEdit(c)}
                style={styles.iconBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${c.label}`}
              >
                <Ionicons name="pencil-outline" size={20} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => tryRemove(c)}
                style={styles.iconBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${c.label}`}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Modal
        visible={addOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setAddOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setAddOpen(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New category</Text>
            <TextInput
              style={styles.modalInput}
              value={addText}
              onChangeText={setAddText}
              placeholder="Name"
              placeholderTextColor={colors.textPlaceholder}
              autoFocus
              autoCorrect={false}
              maxLength={40}
              {...(Platform.OS === 'ios'
                ? { autoCapitalize: 'words' }
                : {})}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setAddOpen(false)}
                style={styles.modalSecondary}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmAdd} style={styles.modalPrimary}>
                <Text style={styles.modalPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setEditOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setEditOpen(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename category</Text>
            <TextInput
              style={styles.modalInput}
              value={editText}
              onChangeText={setEditText}
              placeholder="Name"
              placeholderTextColor={colors.textPlaceholder}
              autoFocus
              autoCorrect={false}
              maxLength={40}
              {...(Platform.OS === 'ios'
                ? { autoCapitalize: 'words' }
                : {})}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setEditOpen(false)}
                style={styles.modalSecondary}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmEdit} style={styles.modalPrimary}>
                <Text style={styles.modalPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: fontSize.detailSectionTitle,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginBottom: 6,
  },
  hint: {
    fontSize: fontSize.detailMetadata,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    marginBottom: 24,
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: fontSize.detailMetadata,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  rowLabelFlex: {
    flex: 1,
    fontSize: fontSize.detailMetadata,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  addBtnText: {
    marginLeft: 4,
    fontSize: fontSize.detailMetadata,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  emptyHint: {
    fontSize: fontSize.detailMetadata,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  iconBtn: {
    padding: 8,
    marginLeft: 4,
  },
  pressed: {
    opacity: 0.85,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlayScrim,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    ...shadows.card,
  },
  modalTitle: {
    fontSize: fontSize.addBillModalTitleCenter,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginBottom: 14,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.inputBorderLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: fontSize.addBillInput,
    color: colors.text,
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modalSecondaryText: {
    fontSize: fontSize.addBillModalAction,
    color: colors.textSecondary,
  },
  modalPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  modalPrimaryText: {
    fontSize: fontSize.addBillModalAction,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
});
