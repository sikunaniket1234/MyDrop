import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "./theme.js";

export interface TabItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
  warn?: boolean;
}

interface Props {
  tabs: TabItem[];
  active: string;
  onSelect: (id: string) => void;
}

export function TabBar({
  tabs,
  active,
  onSelect,
}: Props): React.ReactElement {
  return (
    <View style={styles.tabBar}>
      {tabs.map(item => {
        const isActive = active === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={styles.tab}
          >
            <View style={styles.tabIconWrap}>
              <Text
                style={[
                  styles.tabIcon,
                  isActive && styles.tabIconActive,
                ]}
              >
                {item.icon}
              </Text>
              {item.badge ? (
                <View
                  style={[
                    styles.badge,
                    item.warn && styles.badgeWarn,
                  ]}
                >
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.tabLabel,
                isActive && styles.tabLabelActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: theme.border,
    paddingVertical: 5,
    paddingBottom: 20,
    backgroundColor: theme.surface0,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 5,
  },
  tabIconWrap: {
    position: "relative",
  },
  tabIcon: {
    fontSize: 19,
    color: theme.textMuted,
  },
  tabIconActive: {
    color: theme.textAccent,
  },
  tabLabel: {
    fontSize: 9,
    color: theme.textMuted,
  },
  tabLabelActive: {
    color: theme.textAccent,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.fillAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeWarn: {
    backgroundColor: theme.fillWarning,
  },
  badgeText: {
    fontSize: 8,
    color: "white",
  },
});
