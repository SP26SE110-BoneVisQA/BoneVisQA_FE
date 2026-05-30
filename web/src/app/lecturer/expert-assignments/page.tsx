'use client';

import { useState, useEffect } from 'react';
import { classExpertAssignmentApi, ClassExpertAssignmentDto, ClassExpertAssignmentCreateDto } from '@/lib/api/class-expert-assignment';
import { fetchLecturerClasses } from '@/lib/api/lecturer-classes';
import type { ClassItem } from '@/lib/api/types';

export default function LecturerExpertAssignmentsPage() {
  const [assignments, setAssignments] = useState<ClassExpertAssignmentDto[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ClassExpertAssignmentCreateDto>({
    classId: '',
    expertId: '',
    boneSpecialtyId: '',
    roleInClass: 'Supporting',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const classesData = await fetchLecturerClasses();
      setClasses(classesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignmentsByClass = async (classId: string) => {
    try {
      const data = await classExpertAssignmentApi.getByClass(classId);
      setAssignments(data);
    } catch (error) {
      console.error('Failed to load assignments:', error);
    }
  };

  const handleClassChange = (classId: string) => {
    setFormData({ ...formData, classId });
    if (classId) {
      loadAssignmentsByClass(classId);
    } else {
      setAssignments([]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await classExpertAssignmentApi.create(formData);
      setShowForm(false);
      loadAssignmentsByClass(formData.classId);
      alert('Expert assigned successfully!');
    } catch (error: any) {
      console.error('Failed to create assignment:', error);
      alert(error?.response?.data?.message || 'Failed to assign expert');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this expert from the class?')) return;
    try {
      await classExpertAssignmentApi.delete(id);
      if (formData.classId) {
        loadAssignmentsByClass(formData.classId);
      }
    } catch (error) {
      console.error('Failed to delete assignment:', error);
    }
  };

  const handleUpdateRole = async (id: string, newRole: string) => {
    try {
      await classExpertAssignmentApi.update({ id, roleInClass: newRole });
      if (formData.classId) {
        loadAssignmentsByClass(formData.classId);
      }
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Expert Assignments</h1>
        <p className="text-gray-500 mt-1">
          Manage expert assignments for your classes.
        </p>
      </div>

      {/* Select Class */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Select Class</label>
        <select
          value={formData.classId}
          onChange={(e) => handleClassChange(e.target.value)}
          className="w-full max-w-md p-2 border rounded-lg"
        >
          <option value="">-- Select a class --</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.className}
            </option>
          ))}
        </select>
      </div>

      {/* Assignments List */}
      {formData.classId && (
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Current Expert Assignments</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              {showForm ? 'Cancel' : '+ Assign Expert'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleCreate} className="mb-6 p-4 border rounded bg-gray-50">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Expert ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.expertId}
                    onChange={(e) => setFormData({ ...formData, expertId: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="Enter Expert UUID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Bone Specialty ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.boneSpecialtyId}
                    onChange={(e) => setFormData({ ...formData, boneSpecialtyId: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="Enter Bone Specialty UUID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Role in Class</label>
                  <select
                    value={formData.roleInClass}
                    onChange={(e) => setFormData({ ...formData, roleInClass: e.target.value })}
                    className="w-full p-2 border rounded"
                  >
                    <option value="Supporting">Supporting</option>
                    <option value="Teaching">Teaching</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Assign
                  </button>
                </div>
              </div>
            </form>
          )}

          {assignments.length === 0 ? (
            <p className="text-gray-500">No experts assigned to this class yet.</p>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="p-4 border rounded flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{assignment.expertName || assignment.expertId}</h3>
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        {assignment.roleInClass}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Specialty: {assignment.boneSpecialtyName || assignment.boneSpecialtyId}
                    </p>
                    {assignment.assignedAt && (
                      <p className="text-sm text-gray-500">
                        Assigned: {new Date(assignment.assignedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={assignment.roleInClass}
                      onChange={(e) => handleUpdateRole(assignment.id, e.target.value)}
                      className="p-1 border rounded text-sm"
                    >
                      <option value="Supporting">Supporting</option>
                      <option value="Teaching">Teaching</option>
                    </select>
                    <button
                      onClick={() => handleDelete(assignment.id)}
                      className="text-red-500 hover:underline text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
