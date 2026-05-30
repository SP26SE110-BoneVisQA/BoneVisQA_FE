'use client';

import { useState, useEffect } from 'react';
import { classExpertAssignmentApi, ClassExpertAssignmentDto, ClassExpertAssignmentCreateDto } from '@/lib/api/class-expert-assignment';

interface Props {
  classId: string;
  onClose?: () => void;
  onSuccess?: () => void;
}

export default function ClassExpertAssignments({ classId, onClose, onSuccess }: Props) {
  const [assignments, setAssignments] = useState<ClassExpertAssignmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ClassExpertAssignmentCreateDto>({
    classId: classId,
    expertId: '',
    boneSpecialtyId: '',
    roleInClass: 'Supporting',
  });

  useEffect(() => {
    loadAssignments();
  }, [classId]);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const data = await classExpertAssignmentApi.getByClass(classId);
      setAssignments(data);
    } catch (error) {
      console.error('Failed to load assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await classExpertAssignmentApi.create(formData);
      setShowForm(false);
      loadAssignments();
      onSuccess?.();
    } catch (error: any) {
      console.error('Failed to create assignment:', error);
      alert(error?.response?.data?.message || 'Failed to create assignment');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this expert from the class?')) return;
    try {
      await classExpertAssignmentApi.delete(id);
      loadAssignments();
    } catch (error) {
      console.error('Failed to delete assignment:', error);
    }
  };

  const handleUpdateRole = async (id: string, newRole: string) => {
    try {
      await classExpertAssignmentApi.update({ id, roleInClass: newRole });
      loadAssignments();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Expert Assignments</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          {showForm ? 'Cancel' : '+ Assign Expert'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 border rounded bg-gray-50">
          <div className="grid gap-4">
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

            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Assign
            </button>
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
  );
}
