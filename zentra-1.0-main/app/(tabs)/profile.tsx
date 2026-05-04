import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, LogOut, User as UserIcon, ChevronRight, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import ScrollPicker from '@/components/ScrollPicker';
import PrimaryButton from '@/components/PrimaryButton';
import { calculateBmi, getBmiCategory } from '@/lib/bodyMetrics';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editType, setEditType] = useState<'height' | 'weight' | 'steps' | null>(null);
  const [tempValue, setTempValue] = useState<number>(0);
  const [tempUnit, setTempUnit] = useState<string>('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/auth');
          },
        },
      ]
    );
  };

  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to upload a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setUploadingAvatar(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in before uploading a profile picture.');

      const asset = result.assets[0];
      const extension = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
      const normalizedExtension = extension === 'jpg' ? 'jpeg' : extension;
      const contentType = asset.mimeType || `image/${normalizedExtension}`;
      const filePath = `${user.id}/avatar-${Date.now()}.${extension}`;
      const imageResponse = await fetch(asset.uri);
      const imageData = await imageResponse.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, imageData, {
          contentType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = publicUrlData.publicUrl;
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile((prev: any) => ({ ...prev, avatar_url: avatarUrl }));
    } catch (error: any) {
      Alert.alert('Upload failed', error.message || 'Could not upload profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const openEditModal = (type: 'height' | 'weight' | 'steps') => {
    setEditType(type);
    if (type === 'height') {
      setTempValue(profile?.height_cm || 170);
      setTempUnit(profile?.height_unit || 'cm');
    } else if (type === 'weight') {
      setTempValue(profile?.weight_kg || 70);
      setTempUnit(profile?.weight_unit || 'kg');
    } else if (type === 'steps') {
      setTempValue(profile?.steps_goal || 8000);
      setTempUnit('');
    }
    setEditModalVisible(true);
  };

  const cmToFeet = (cm: number) => {
    const inches = Math.round(cm / 2.54);
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return { feet, inches: remainingInches };
  };

  const feetToCm = (feet: number, inches: number) => {
    return Math.round((feet * 12 + inches) * 2.54);
  };

  const kgToLbs = (kg: number) => Math.round(kg / 0.453592);
  const lbsToKg = (lbs: number) => Math.round(lbs * 0.453592);

  const ftInValues = useMemo(() => {
    const values = [];
    for (let feet = 4; feet <= 7; feet++) {
      for (let inches = 0; inches < 12; inches++) {
        const cm = feetToCm(feet, inches);
        if (cm >= 120 && cm <= 220) {
          values.push({ display: `${feet}'${inches}"`, cm });
        }
      }
    }
    return values;
  }, []);

  const lbValues = useMemo(() => {
    const values = [];
    for (let i = 80; i <= 485; i++) {
      values.push({ display: `${i} lb`, kg: lbsToKg(i) });
    }
    return values;
  }, []);

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let updateData: any = {};
      let newHeight = profile?.height_cm;
      let newWeight = profile?.weight_kg;

      if (editType === 'height') {
        updateData = {
          height_cm: tempValue,
          height_unit: tempUnit,
        };
        newHeight = tempValue;
      } else if (editType === 'weight') {
        updateData = {
          weight_kg: tempValue,
          weight_unit: tempUnit,
        };
        newWeight = tempValue;
      } else if (editType === 'steps') {
        updateData = {
          steps_goal: tempValue,
        };
      }

      if (newHeight && newWeight && (editType === 'height' || editType === 'weight')) {
        const bmi = calculateBmi(newHeight, newWeight);
        updateData.bmi = bmi;
        updateData.onboarding_completed = true;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      setEditModalVisible(false);
      loadProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const getHeightValues = () => {
    if (tempUnit === 'cm') {
      return Array.from({ length: 101 }, (_, i) => `${120 + i} cm`);
    } else {
      return ftInValues.map((v) => v.display);
    }
  };

  const getWeightValues = () => {
    if (tempUnit === 'kg') {
      return Array.from({ length: 186 }, (_, i) => `${35 + i} kg`);
    } else {
      return lbValues.map((v) => v.display);
    }
  };

  const getStepsValues = () => {
    return Array.from({ length: 191 }, (_, i) => `${(1000 + i * 100).toLocaleString()}`);
  };

  const getValueIndex = () => {
    if (editType === 'height') {
      if (tempUnit === 'cm') {
        return tempValue - 120;
      } else {
        const index = ftInValues.findIndex((v) => v.cm === tempValue);
        if (index !== -1) return index;

        let closestIndex = 0;
        let minDiff = Math.abs(ftInValues[0].cm - tempValue);

        for (let i = 1; i < ftInValues.length; i++) {
          const diff = Math.abs(ftInValues[i].cm - tempValue);
          if (diff < minDiff) {
            minDiff = diff;
            closestIndex = i;
          }
        }

        return closestIndex;
      }
    } else if (editType === 'weight') {
      if (tempUnit === 'kg') {
        return tempValue - 35;
      } else {
        const index = lbValues.findIndex((v) => v.kg === tempValue);
        if (index !== -1) return index;

        let closestIndex = 0;
        let minDiff = Math.abs(lbValues[0].kg - tempValue);

        for (let i = 1; i < lbValues.length; i++) {
          const diff = Math.abs(lbValues[i].kg - tempValue);
          if (diff < minDiff) {
            minDiff = diff;
            closestIndex = i;
          }
        }

        return closestIndex;
      }
    } else if (editType === 'steps') {
      return Math.floor((tempValue - 1000) / 100);
    }
    return 0;
  };

  const handleValueChange = (index: number) => {
    if (editType === 'height') {
      if (tempUnit === 'cm') {
        setTempValue(120 + index);
      } else {
        setTempValue(ftInValues[index].cm);
      }
    } else if (editType === 'weight') {
      if (tempUnit === 'kg') {
        setTempValue(35 + index);
      } else {
        setTempValue(lbValues[index].kg);
      }
    } else if (editType === 'steps') {
      setTempValue(1000 + index * 100);
    }
  };

  const calculatedBmi = calculateBmi(profile?.height_cm, profile?.weight_kg);
  const bmi = profile?.bmi ? Number(profile.bmi) : calculatedBmi;
  const bmiCategory = getBmiCategory(bmi);

  return (
    <LinearGradient
      colors={[theme.colors.background, '#0A0A0A']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={handlePickAvatar}
              disabled={uploadingAvatar}
              activeOpacity={0.85}
            >
              <View style={styles.avatar}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <UserIcon size={48} color={theme.colors.white} />
                )}
                <View style={styles.cameraBadge}>
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color={theme.colors.white} />
                  ) : (
                    <Camera size={16} color={theme.colors.white} />
                  )}
                </View>
              </View>
              <Text style={styles.avatarHint}>
                {uploadingAvatar ? 'Uploading...' : 'Tap to update photo'}
              </Text>
            </TouchableOpacity>
            {profile && (
              <>
                <Text style={styles.name}>
                  {profile.first_name} {profile.last_name}
                </Text>
                {bmi && (
                  <View style={styles.bmiContainer}>
                    <Text style={styles.bmiText}>
                      BMI: {bmi}
                    </Text>
                    {bmiCategory && (
                      <Text style={styles.bmiCategory}>
                        {bmiCategory}
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}
          </View>

          <View style={styles.settingsContainer}>
            <TouchableOpacity style={styles.settingItem} onPress={() => openEditModal('height')}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Height</Text>
                <Text style={styles.settingValue}>
                  {profile?.height_cm ? `${profile.height_cm} cm` : 'Not set'}
                </Text>
              </View>
              <ChevronRight size={20} color={theme.colors.secondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => openEditModal('weight')}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Weight</Text>
                <Text style={styles.settingValue}>
                  {profile?.weight_kg ? `${profile.weight_kg} kg` : 'Not set'}
                </Text>
              </View>
              <ChevronRight size={20} color={theme.colors.secondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => openEditModal('steps')}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Daily Steps Goal</Text>
                <Text style={styles.settingValue}>
                  {profile?.steps_goal ? `${profile.steps_goal.toLocaleString()} steps` : '8000 steps'}
                </Text>
              </View>
              <ChevronRight size={20} color={theme.colors.secondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LogOut size={20} color={theme.colors.white} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>

        <Modal
          visible={editModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setEditModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Edit {editType === 'height' ? 'Height' : editType === 'weight' ? 'Weight' : 'Steps Goal'}
                </Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <X size={24} color={theme.colors.white} />
                </TouchableOpacity>
              </View>

              {editType !== 'steps' && (
                <View style={styles.unitToggle}>
                  {editType === 'height' ? (
                    <>
                      <TouchableOpacity
                        style={[styles.unitButton, tempUnit === 'cm' && styles.unitButtonActive]}
                        onPress={() => setTempUnit('cm')}
                      >
                        <Text style={[styles.unitText, tempUnit === 'cm' && styles.unitTextActive]}>cm</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.unitButton, tempUnit === 'ft-in' && styles.unitButtonActive]}
                        onPress={() => setTempUnit('ft-in')}
                      >
                        <Text style={[styles.unitText, tempUnit === 'ft-in' && styles.unitTextActive]}>ft-in</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.unitButton, tempUnit === 'kg' && styles.unitButtonActive]}
                        onPress={() => setTempUnit('kg')}
                      >
                        <Text style={[styles.unitText, tempUnit === 'kg' && styles.unitTextActive]}>kg</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.unitButton, tempUnit === 'lb' && styles.unitButtonActive]}
                        onPress={() => setTempUnit('lb')}
                      >
                        <Text style={[styles.unitText, tempUnit === 'lb' && styles.unitTextActive]}>lb</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              <ScrollPicker
                values={
                  editType === 'height'
                    ? getHeightValues()
                    : editType === 'weight'
                    ? getWeightValues()
                    : getStepsValues()
                }
                selectedIndex={getValueIndex()}
                onValueChange={handleValueChange}
              />

              <PrimaryButton title="Save" onPress={handleSave} style={styles.saveButton} />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarButton: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.card,
    borderWidth: 2,
    borderColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.secondary,
    marginTop: 8,
  },
  name: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 8,
  },
  bmiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bmiText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  bmiCategory: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
  },
  settingsContainer: {
    marginBottom: 32,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: theme.borderRadius.md,
    marginBottom: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 4,
  },
  settingValue: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: theme.borderRadius.md,
    gap: 12,
  },
  signOutText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: 4,
    marginBottom: 24,
  },
  unitButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  unitButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  unitText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.secondary,
    fontWeight: '500',
  },
  unitTextActive: {
    color: theme.colors.white,
  },
  saveButton: {
    marginTop: 24,
  },
});
