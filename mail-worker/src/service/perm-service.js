import orm from '../entity/orm';
import perm from '../entity/perm';
import { eq, ne, and, asc } from 'drizzle-orm';
import rolePerm from '../entity/role-perm';
import user from '../entity/user';
import role from '../entity/role';
import { permConst } from '../const/entity-const';
import { t } from '../i18n/i18n'
const labels = {
  '邮件':'message','邮件发送':'sendEmail','邮件删除':'delete','邮箱侧栏':'userAccount',
  '邮箱查看':'tabMailboxes','邮箱添加':'addAccount','邮箱删除':'delAccount','个人设置':'settings',
  '用户注销':'deleteUser','分析页':'analytics','数据查看':'analytics','用户信息':'allUsers',
  '用户查看':'userDetails','用户添加':'addUser','密码修改':'changePassword','状态修改':'tabStatus',
  '权限修改':'changePerm','用户删除':'adminDeleteUser','邮件列表':'allMail','邮件查看':'allMail',
  '权限控制':'permissions','身份添加':'addRoleTitle','身份查看':'permissions','身份修改':'changeRoleTitle',
  '身份删除':'delete','注册密钥':'inviteCode','密钥查看':'inviteCode','密钥添加':'addRegKey',
  '密钥删除':'delete','系统设置':'SystemSettings','设置查看':'SystemSettings','设置修改':'change','发件重置':'reset'
};

const permService = {
	async tree(c) {
		const pList = await orm(c).select().from(perm).where(eq(perm.pid, 0)).orderBy(asc(perm.sort)).all();
		const cList = await orm(c).select().from(perm).where(ne(perm.pid, 0)).orderBy(asc(perm.sort)).all();

		cList.forEach(cItem => {
			cItem.nameKey = labels[cItem.name];
			cItem.name = t('perms.' + cItem.name)
		})

		pList.forEach(pItem => {
			pItem.nameKey = labels[pItem.name];
			pItem.name = t('perms.' + pItem.name)
			pItem.children = cList.filter(cItem => cItem.pid === pItem.permId)
		})
		return pList;
	},

	async userPermKeys(c, userId) {
		const userPerms = await orm(c).select({permKey: perm.permKey}).from(user)
			.leftJoin(role, eq(role.roleId,user.type))
			.rightJoin(rolePerm, eq(rolePerm.roleId,role.roleId))
			.leftJoin(perm, eq(rolePerm.permId,perm.permId))
			.where(and(eq(user.userId,userId),eq(perm.type,permConst.type.BUTTON)))
			.all();
		return userPerms.map(perm => perm.permKey);
	}
}

export default permService
