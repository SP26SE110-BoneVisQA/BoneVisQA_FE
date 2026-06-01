'use client';

import React from 'react';
import { BarChart3, Award, TrendingUp, AlertCircle } from 'lucide-react';

interface CompetencyChartProps {
  competencies: Array<{
    competencyName?: string;
    percentage: number;
    level: string;
  }>;
  distribution?: Array<{
    level: string;
    studentCount: number;
    percentage: number;
  }>;
  weakTopics?: Array<{
    topicName: string;
    averageScore: number;
    recommendation: string;
  }>;
  strongTopics?: Array<{
    topicName: string;
    averageScore: number;
  }>;
  classAverage?: number;
}

export default function CompetencyChart({
  competencies,
  distribution,
  weakTopics,
  strongTopics,
  classAverage = 0,
}: CompetencyChartProps) {
  const getLevelColor = (percentage: number) => {
    if (percentage >= 80) return { bg: 'bg-success', text: 'text-success', label: 'Expert' };
    if (percentage >= 60) return { bg: 'bg-primary', text: 'text-primary', label: 'Proficient' };
    if (percentage >= 40) return { bg: 'bg-warning', text: 'text-warning', label: 'Intermediate' };
    if (percentage >= 20) return { bg: 'bg-blue-500', text: 'text-blue-500', label: 'Beginner' };
    return { bg: 'bg-muted-foreground', text: 'text-muted-foreground', label: 'Novice' };
  };

  const chartColors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500', 'bg-orange-500'];

  return (
    <div className="space-y-6">
      {/* Class Average Header */}
      <div className="bg-gradient-to-r from-primary/20 to-primary/5 rounded-xl p-6 border border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Class Average Competency</p>
            <p className="text-4xl font-bold text-card-foreground">{classAverage.toFixed(1)}%</p>
          </div>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            classAverage >= 70 ? 'bg-success/20' : classAverage >= 40 ? 'bg-warning/20' : 'bg-destructive/20'
          }`}>
            <Award className={`w-8 h-8 ${
              classAverage >= 70 ? 'text-success' : classAverage >= 40 ? 'text-warning' : 'text-destructive'
            }`} />
          </div>
        </div>
      </div>

      {/* Competency Bars */}
      {competencies.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-card-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Topic Competencies
          </h4>
          <div className="space-y-3">
            {competencies.map((comp, idx) => {
              const levelConfig = getLevelColor(comp.percentage);
              return (
                <div key={comp.competencyName || idx} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-card-foreground font-medium">
                      {comp.competencyName || 'Unknown Topic'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`${levelConfig.text} font-semibold`}>
                        {comp.percentage.toFixed(0)}%
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${levelConfig.bg}/20 ${levelConfig.text}`}>
                        {levelConfig.label}
                      </span>
                    </div>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${levelConfig.bg} transition-all duration-500`}
                      style={{ width: `${comp.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Distribution */}
      {distribution && distribution.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-card-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Competency Distribution
          </h4>
          <div className="grid grid-cols-5 gap-2">
            {distribution.map((dist, idx) => {
              const levelConfig = getLevelColor(
                dist.level === 'Expert' ? 90 :
                dist.level === 'Proficient' ? 70 :
                dist.level === 'Intermediate' ? 50 :
                dist.level === 'Beginner' ? 30 : 10
              );
              return (
                <div
                  key={dist.level}
                  className={`p-3 rounded-lg border ${levelConfig.bg}/20 text-center`}
                >
                  <p className={`text-lg font-bold ${levelConfig.text}`}>{dist.percentage.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">{dist.level}</p>
                  <p className="text-xs text-muted-foreground mt-1">{dist.studentCount} students</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weak Topics */}
      {weakTopics && weakTopics.length > 0 && (
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <h4 className="text-sm font-medium text-destructive">Topics Needing Attention</h4>
          </div>
          <div className="space-y-3">
            {weakTopics.map((topic, idx) => (
              <div key={idx} className="bg-background/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-card-foreground">{topic.topicName}</span>
                  <span className="text-sm font-semibold text-destructive">
                    {topic.averageScore.toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{topic.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strong Topics */}
      {strongTopics && strongTopics.length > 0 && (
        <div className="p-4 rounded-lg border border-success/30 bg-success/5">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-success" />
            <h4 className="text-sm font-medium text-success">Strong Areas</h4>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {strongTopics.map((topic, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-background/50 rounded-lg p-2"
              >
                <span className="text-sm text-card-foreground">{topic.topicName}</span>
                <span className="text-sm font-semibold text-success">
                  {topic.averageScore.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
